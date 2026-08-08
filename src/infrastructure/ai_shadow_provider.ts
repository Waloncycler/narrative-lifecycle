import { createHash } from 'node:crypto';
import type { AiCandidateSuggestion, AiShadowAuditRecord, EvidenceIntakeSession } from '@/types/intake';
import { AI_SHADOW_PROMPT_VERSION, fallbackAiCandidate, withAiValidation } from '@/domain/ai_shadow_validation';

export interface AiShadowProviderConfig {
  provider: string;
  endpoint?: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
}

export function aiShadowConfigFromEnv(env: NodeJS.ProcessEnv): AiShadowProviderConfig {
  return {
    provider: env.NARRATIVE_AI_SHADOW_PROVIDER ?? 'disabled',
    endpoint: env.NARRATIVE_AI_SHADOW_ENDPOINT,
    apiKey: env.NARRATIVE_AI_SHADOW_API_KEY,
    model: env.NARRATIVE_AI_SHADOW_MODEL ?? 'ai-shadow-disabled',
    timeoutMs: Number(env.NARRATIVE_AI_SHADOW_TIMEOUT_MS ?? 15000),
  };
}

export class ProviderNeutralAiShadowAdapter {
  constructor(private readonly config: AiShadowProviderConfig) {}

  async generate(session: EvidenceIntakeSession): Promise<{ candidates: AiCandidateSuggestion[]; audit: AiShadowAuditRecord }> {
    const generatedAt = new Date().toISOString();
    const errors: string[] = [];
    const requestFingerprints: string[] = [];
    const responseFingerprints: string[] = [];
    let rawCandidates: AiCandidateSuggestion[] = [];

    if (!this.config.endpoint || !this.config.apiKey || this.config.provider === 'disabled') {
      errors.push('ai_shadow_provider_not_configured');
    } else {
      try {
        const request = buildRequest(session, this.config.model);
        requestFingerprints.push(fingerprint(redactedRequest(request)));
        const response = await fetchWithTimeout(this.config.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(request),
        }, this.config.timeoutMs);
        const body = await response.text();
        responseFingerprints.push(fingerprint(body));
        if (!response.ok) throw new Error(`provider_http_${response.status}`);
        rawCandidates = parseProviderResponse(body, session, this.config);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const candidates = session.candidates.map((rule) => {
      const raw = rawCandidates.find((candidate) => candidate.candidate_id === rule.candidate_id);
      if (!raw) return fallbackAiCandidate({
        rule,
        provider: this.config.provider,
        modelVersion: this.config.model,
        reason: errors[0] ?? 'ai_candidate_missing',
      });
      const validated = withAiValidation({ ai: raw, rule, rawText: session.raw_document.text });
      if (validated.validation_status === 'failed') {
        return fallbackAiCandidate({
          rule,
          provider: this.config.provider,
          modelVersion: this.config.model,
          reason: validated.validation_errors?.join(',') ?? 'ai_candidate_invalid',
        });
      }
      return validated;
    });

    const fallbackCount = candidates.filter((candidate) => candidate.fallback_used).length;
    const audit: AiShadowAuditRecord = {
      audit_id: `ai_shadow_${generatedAt.slice(0, 10).replaceAll('-', '')}_${session.session_id}`,
      generated_at: generatedAt,
      session_id: session.session_id,
      provider: this.config.provider,
      model_version: this.config.model,
      prompt_version: AI_SHADOW_PROMPT_VERSION,
      status: fallbackCount === candidates.length ? 'fallback' : fallbackCount ? 'fallback' : 'passed',
      candidate_count: candidates.length,
      fallback_count: fallbackCount,
      invalid_count: candidates.filter((candidate) => candidate.validation_status === 'failed').length,
      request_fingerprints: requestFingerprints,
      response_fingerprints: responseFingerprints,
      errors,
      secret_redaction: 'api_key_not_persisted',
    };
    return { candidates, audit };
  }
}

function buildRequest(session: EvidenceIntakeSession, model: string): Record<string, unknown> {
  return {
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You extract research-only Evidence Candidates for a narrative lifecycle dashboard.',
          'Return JSON only with {"candidates":[...]}',
          'Do not provide trading advice.',
          'Every candidate must preserve candidate_id, original_quote, suggested_evidence, suggested_reason, uncertainty_notes, alternative_mappings.',
          'Use only facts supported by original_quote.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          prompt_version: AI_SHADOW_PROMPT_VERSION,
          raw_document: session.raw_document,
          chunks: session.chunks,
          provenance_records: session.provenance_records,
          rule_candidates: session.candidates,
        }),
      },
    ],
  };
}

function parseProviderResponse(body: string, session: EvidenceIntakeSession, config: AiShadowProviderConfig): AiCandidateSuggestion[] {
  const parsed = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }>; candidates?: AiCandidateSuggestion[] };
  const content = parsed.choices?.[0]?.message?.content;
  const json = content ? JSON.parse(content) as { candidates?: AiCandidateSuggestion[] } : parsed;
  return (json.candidates ?? []).map((candidate) => ({
    ...candidate,
    provider: config.provider,
    model_version: config.model,
    prompt_version: AI_SHADOW_PROMPT_VERSION,
    shadow_mode: true,
  }));
}

function redactedRequest(request: Record<string, unknown>): Record<string, unknown> {
  return { ...request, api_key: '[redacted]' };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16);
}
