import { createHash } from 'node:crypto';
import type { EvidenceCandidate, EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { AgentEvidenceCandidate, IntakeAgentAudit } from '@/features/intake/types/intake_agent';
import type { EvidenceImportDraft } from '@/features/evidence/types/evidence_import';
import { INTAKE_AGENT_PROMPT_VERSION, verifyAgentCandidate } from '@/features/intake/domain/intake_agent_rules';
import { compactIndustryContext, suggestIndustry } from '@/features/reporting/domain/industry_packs';
import { INTAKE_AGENT_SYSTEM_PROMPT, buildTopicContext } from '@/features/intake/domain/intake_agent_prompt';
import { buildSkillContext } from '@/features/intake/domain/intake_agent_skill';
import type { IndustryPack } from '@/features/reporting/types/industry';
import type { IntakeLearningProfile } from '@/features/intake/types/intake_learning';
import { learningProfileContext } from '@/features/intake/types/intake_learning';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { StageDiff } from '@/features/stages/types/diff';

export interface OpenAiCompatibleAgentConfig {
  provider: string;
  endpoint?: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  batchSize?: number;
  concurrency?: number;
}

export function intakeAgentConfigFromEnv(env: NodeJS.ProcessEnv): OpenAiCompatibleAgentConfig {
  const deepseekConfigured = Boolean(env.DEEPSEEK_API_KEY);
  const minimaxConfigured = Boolean(env.MINIMAX_API_KEY);
  const provider = env.NARRATIVE_AGENT_PROVIDER ?? (deepseekConfigured ? 'deepseek' : minimaxConfigured ? 'minimax' : 'disabled');
  const deepseekBaseUrl = (env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1').replace(/\/$/, '');
  const minimaxBaseUrl = (env.MINIMAX_BASE_URL ?? 'https://api.minimaxi.com/v1').replace(/\/$/, '');
  const deepseekModel = env.DEEPSEEK_MODEL ?? 'deepseek-chat';
  const minimaxModel = env.MINIMAX_MODEL ?? 'MiniMax-M3';
  return {
    provider,
    endpoint: env.NARRATIVE_AGENT_ENDPOINT ?? (deepseekConfigured ? `${deepseekBaseUrl}/chat/completions` : minimaxConfigured ? `${minimaxBaseUrl}/chat/completions` : undefined),
    apiKey: env.NARRATIVE_AGENT_API_KEY ?? env.DEEPSEEK_API_KEY ?? env.MINIMAX_API_KEY,
    model: env.NARRATIVE_AGENT_MODEL ?? (deepseekConfigured ? deepseekModel : minimaxConfigured ? minimaxModel : 'intake-agent-disabled'),
    timeoutMs: Number(env.NARRATIVE_AGENT_TIMEOUT_MS ?? 600000),
    batchSize: boundedBatchSize(env.NARRATIVE_AGENT_BATCH_SIZE),
    concurrency: boundedConcurrency(env.NARRATIVE_AGENT_CONCURRENCY),
  };
}

export class OpenAiCompatibleIntakeAgentAdapter {
  constructor(private readonly config: OpenAiCompatibleAgentConfig) {}

  async generate(
    session: EvidenceIntakeSession,
    industryPacks: IndustryPack[] = [],
    learningProfile: IntakeLearningProfile | null = null,
    topicRegistry: TopicRegistry | null = null,
    evidenceNodes: EvidenceNode[] = [],
    diff: StageDiff | null = null,
  ): Promise<{ candidates: AgentEvidenceCandidate[]; audit: IntakeAgentAudit }> {
    const generatedAt = new Date().toISOString();
    const batchSize = boundedBatchSize(this.config.batchSize);
    const batches = chunkCandidates(session.candidates, batchSize);
    const requestFingerprints: string[] = [];
    const responseFingerprints: string[] = [];
    const errors: string[] = [];
    const candidates: AgentEvidenceCandidate[] = [];

    if (!this.config.endpoint || !this.config.apiKey || this.config.provider === 'disabled') {
      errors.push('intake_agent_provider_not_configured');
      candidates.push(...session.candidates.map((rule) => fallbackCandidate(rule, session, this.config, errors[0])));
    } else {
      const concurrency = boundedConcurrency(this.config.concurrency);
      for (let start = 0; start < batches.length; start += concurrency) {
        const group = batches.slice(start, start + concurrency);
        const results = await Promise.all(group.map(async (batch, offset) => {
          const index = start + offset;
          const batchSession = { ...session, candidates: batch };
          const request = buildRequest(batchSession, this.config.model, industryPacks, learningProfile, topicRegistry, evidenceNodes, diff);
          const requestFingerprint = fingerprint(request);
          try {
            const response = await fetchWithProviderRetry(this.config.endpoint!, {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
              body: JSON.stringify(request),
            }, this.config.timeoutMs);
            const body = await response.text();
            if (!response.ok) throw new Error(`provider_http_${response.status}`);
            const raw = parseResponse(body, batchSession, this.config);
            return { requestFingerprint, responseFingerprint: fingerprint(body), candidates: reconcileBatch(raw, batch, session, this.config), error: null };
          } catch (caught) {
            const reason = caught instanceof Error ? caught.message : String(caught);
            return { requestFingerprint, responseFingerprint: null, candidates: batch.map((rule) => fallbackCandidate(rule, session, this.config, reason)), error: `batch_${index + 1}_of_${batches.length}:${reason}` };
          }
        }));
        for (const result of results) {
          requestFingerprints.push(result.requestFingerprint);
          if (result.responseFingerprint) responseFingerprints.push(result.responseFingerprint);
          if (result.error) errors.push(result.error);
          candidates.push(...result.candidates);
        }
      }
    }

    const mergedCandidates = dedupeCandidates(candidates);
    const fallbackCount = mergedCandidates.filter((candidate) => candidate.fallback_used).length;
    const requestFingerprint = aggregateFingerprints(requestFingerprints);
    const responseFingerprint = responseFingerprints.length ? aggregateFingerprints(responseFingerprints) : null;
    const error = errors.length ? errors.join(';') : null;
    const audit: IntakeAgentAudit = {
      audit_id: `intake_agent_${generatedAt.slice(0, 10).replaceAll('-', '')}_${session.session_id}`,
      generated_at: generatedAt,
      session_id: session.session_id,
      provider: this.config.provider,
      model_version: this.config.model,
      prompt_version: INTAKE_AGENT_PROMPT_VERSION,
      status: fallbackCount === mergedCandidates.length && mergedCandidates.length > 0
        ? 'fallback'
        : error || mergedCandidates.some((candidate) => candidate.validation_status === 'failed') ? 'failed' : 'passed',
      request_fingerprint: requestFingerprint,
      response_fingerprint: responseFingerprint,
      error,
      secret_redaction: 'api_key_not_persisted',
    };
    return { candidates: mergedCandidates, audit };
  }
}

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 1;
const MAX_CONCURRENCY = 4;

function boundedBatchSize(value: string | number | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? DEFAULT_BATCH_SIZE);
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(parsed)));
}

function boundedConcurrency(value: string | number | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? DEFAULT_CONCURRENCY);
  if (!Number.isFinite(parsed)) return DEFAULT_CONCURRENCY;
  return Math.min(MAX_CONCURRENCY, Math.max(1, Math.floor(parsed)));
}

async function fetchWithProviderRetry(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const attempts = 3;
  let response: Response | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    response = await fetchWithTimeout(url, init, timeoutMs);
    if (response.ok || (response.status !== 429 && response.status < 500)) return response;
    if (attempt === attempts - 1) return response;
    const retryAfter = Number(response.headers.get('retry-after'));
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(10_000, retryAfter * 1000)
      : Math.min(8_000, 1_000 * (2 ** attempt));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return response!;
}

function chunkCandidates(candidates: EvidenceCandidate[], batchSize: number): EvidenceCandidate[][] {
  const batches: EvidenceCandidate[][] = [];
  for (let index = 0; index < candidates.length; index += batchSize) {
    batches.push(candidates.slice(index, index + batchSize));
  }
  return batches;
}

function reconcileBatch(
  raw: AgentEvidenceCandidate[],
  rules: EvidenceCandidate[],
  session: EvidenceIntakeSession,
  config: OpenAiCompatibleAgentConfig,
): AgentEvidenceCandidate[] {
  const matchedRawIds = new Set<string>();
  const candidates = rules.map((rule) => {
    const modelCandidate = findModelCandidate(raw, rule);
    if (modelCandidate) matchedRawIds.add(modelCandidate.agent_candidate_id);
    if (!modelCandidate) return fallbackCandidate(rule, session, config, 'agent_candidate_missing');
    const verification = verifyAgentCandidate({ candidate: modelCandidate, session, ruleCandidate: rule });
    return verification.errors.length
      ? fallbackCandidate(rule, session, config, verification.errors.join(','))
      : modelCandidate;
  });
  const extras = raw
    .filter((candidate) => !matchedRawIds.has(candidate.agent_candidate_id))
    .map((candidate) => {
      const verification = verifyAgentCandidate({ candidate, session });
      return verification.errors.length
        ? { ...candidate, validation_status: 'failed' as const, validation_errors: verification.errors }
        : candidate;
    });
  return [...candidates, ...extras];
}

function dedupeCandidates(candidates: AgentEvidenceCandidate[]): AgentEvidenceCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.source_candidate_id
      ? `rule:${candidate.source_candidate_id}`
      : `extra:${candidate.raw_document_id}:${candidate.quote_start_offset}:${candidate.quote_end_offset}:${candidate.original_quote}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function aggregateFingerprints(values: string[]): string {
  if (values.length === 0) return fingerprint([]);
  return values.length === 1 ? values[0] : fingerprint(values);
}

/** Cap on the raw document text sent to the model. Long transcripts slow
 *  generation dramatically; rule candidates already quote the salient text. */
const MAX_RAW_TEXT_CHARS = 16000;

/** Compact per-candidate output contract. Verbose model output blew past the
 *  generation budget (finish_reason=length) and stalled the loop; a strict
 *  schema keeps the response small enough to complete in one shot. Hard length
 *  budgets matter: one rule candidate must fit in ~180 tokens so all rule
 *  candidates (and up to 5 new facts) complete inside max_tokens. */
const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['candidates'],
  candidate_fields: [
    { name: 'source_candidate_id', description: 'Echo rule_candidates[].candidate_id when extending a rule candidate; otherwise omit and use candidate_id. Each rule candidate id must appear at most once.' },
    { name: 'candidate_id', description: 'Only for new agent-only facts; snake_case, unique.' },
    { name: 'quote', description: 'Exact verbatim quote from raw_document; at most 200 characters.' },
    { name: 'supported_fact', description: 'One short factual sentence; at most 40 tokens.' },
    { name: 'inferred_interpretation', description: 'One short interpretation sentence; at most 40 tokens; must differ from supported_fact.' },
    { name: 'core_topic', description: 'snake_case topic_id from the topic_catalog, or a new provisional_* id.' },
    { name: 'branch_id', description: 'snake_case branch_id or null.' },
    { name: 'scope', description: 'parent when no branch, branch when branch_id set.' },
    { name: 'evidence_strength', description: 'E0 | E1 | E2 | E3 | E4.' },
    { name: 'chain_relation', description: 'Optional: supports | contradicts | updates | duplicates | branch_only | fills_gap. This is a candidate-only relationship, never a Stage decision.' },
    { name: 'target_evidence_ids', description: 'Optional existing evidence ids this fact relates to; only echo ids supplied in existing_evidence_context.' },
    { name: 'target_stage_gate', description: 'Optional: stable_label | reality_validation | pricing_adoption | capital_confirmation. This names a missing gate, not a Stage.' },
    { name: 'suggested_reason', description: 'One short sentence; at most 25 tokens.' },
  ],
};

function buildRequest(
  session: EvidenceIntakeSession,
  model: string,
  industryPacks: IndustryPack[],
  learningProfile: IntakeLearningProfile | null,
  topicRegistry: TopicRegistry | null,
  evidenceNodes: EvidenceNode[],
  diff: StageDiff | null,
): Record<string, unknown> {
  // Keep the model payload compact: full candidate drafts are redundant and a
  // ~150KB prompt pushed MiniMax-M3 past the timeout. Only the id + quote +
  // suggested mapping are needed for the model to confirm/extend rule facts.
  const ruleCandidatesForModel = session.candidates.map((candidate) => ({
    candidate_id: candidate.candidate_id,
    original_quote: candidate.original_quote,
    suggested_topic_id: candidate.suggested_evidence.topic_id ?? null,
    suggested_branch_id: candidate.suggested_evidence.branch_id ?? null,
    suggested_scope: candidate.suggested_evidence.scope ?? null,
  }));
  const rawText = session.raw_document.text.length > MAX_RAW_TEXT_CHARS
    ? session.raw_document.text.slice(0, MAX_RAW_TEXT_CHARS)
    : session.raw_document.text;
  const messages = [
    {
      role: 'system',
      content: `${INTAKE_AGENT_SYSTEM_PROMPT}\nPrompt version: ${INTAKE_AGENT_PROMPT_VERSION}.`,
    },
    {
      role: 'user',
      content: JSON.stringify({
        output_schema: OUTPUT_SCHEMA,
        raw_document: { ...session.raw_document, text: rawText },
        rule_candidates: ruleCandidatesForModel,
        industry_packs: compactIndustryContext(industryPacks),
        topic_catalog: topicRegistry ? buildTopicContext(topicRegistry) : null,
        existing_evidence_context: compactEvidenceContext(evidenceNodes),
        latest_diff_context: compactDiffContext(diff),
        operator_learning_profile: learningProfile ? JSON.parse(learningProfileContext(learningProfile)) : null,
        operator_skills: buildSkillContext(),
      }),
    },
  ];
  // The seed derives from the stable request content (without itself), so the
  // same session always samples the same way instead of drifting between runs.
  // MiniMax M3 honours seed for best-effort deterministic sampling.
  const seedSource: Record<string, unknown> = {
    model,
    temperature: 0,
    max_tokens: 16000,
    response_format: { type: 'json_object' },
    messages,
  };
  const request: Record<string, unknown> = { ...seedSource };
  if (model.includes('M3')) request.thinking = { type: 'disabled' };
  request.seed = deriveSeed(seedSource);
  return request;
}

function compactEvidenceContext(evidenceNodes: EvidenceNode[]): Array<Record<string, unknown>> {
  return evidenceNodes.slice(-30).map((item) => ({
    evidence_id: item.evidence_id,
    topic_id: item.topic_id,
    branch_id: item.branch_id ?? null,
    scope: item.parent_or_branch ?? 'parent',
    evidence_strength: item.evidence_strength,
    affected_layer: item.affected_layer,
    event_title: item.event_title.slice(0, 180),
  }));
}

function compactDiffContext(diff: StageDiff | null): Record<string, unknown> | null {
  if (!diff) return null;
  return {
    generated_at: diff.generated_at,
    changes: diff.topic_changes.slice(0, 20).map((item) => ({
      topic_id: item.topic_id,
      branch_id: item.branch_id,
      change_type: item.change_type,
      current_stage: item.current_stage,
      current_evidence_ids: item.current_evidence_ids.slice(-5),
      why_not_higher_stage: item.current_why_not_higher_stage,
    })),
  };
}

/** Derives a deterministic sampling seed (0..2^31-1) from request content. */
export function deriveSeed(request: Record<string, unknown>): number {
  const digest = createHash('sha256').update(JSON.stringify(request)).digest('hex');
  return Number.parseInt(digest.slice(0, 8), 16) & 0x7fffffff;
}

function parseResponse(body: string, session: EvidenceIntakeSession, config: OpenAiCompatibleAgentConfig): AgentEvidenceCandidate[] {
  const parsed = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }>; candidates?: AgentEvidenceCandidate[] };
  const content = parsed.choices?.[0]?.message?.content;
  const value = content ? JSON.parse(sanitizeModelJson(extractJsonObject(content))) as { candidates?: AgentEvidenceCandidate[] } : parsed;
  if (!Array.isArray(value.candidates)) throw new Error('provider_response_missing_candidates');
  return value.candidates
    .map((candidate, index) => normalizeModelCandidate(candidate as unknown as Record<string, unknown>, index, session, config))
    .filter((candidate): candidate is AgentEvidenceCandidate => Boolean(candidate));
}

/**
 * Repairs common non-JSON escapes models emit around CJK quotes (e.g. `\“`
 * and `\”`). JSON only allows `\"`; a stray backslash before a curly quote
 * makes the whole response unparseable, so strip the backslash and keep the
 * raw character.
 */
export function sanitizeModelJson(text: string): string {
  return text.replace(/\\([“”‘’«»])/g, '$1');
}

/**
 * Extracts the first balanced JSON object from a model response. Reasoning
 * models (e.g. MiniMax M2.x) may prefix their answer with a <think>…</think>
 * block; the JSON object is located by bracket matching and parsed on its own.
 */
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('provider_response_not_json');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('provider_response_unbalanced_json');
}

/**
 * Matches a raw model candidate back to a rule candidate. The model may echo
 * the rule's `source_candidate_id` or invent its own id, and it quotes natural
 * language while rule quotes are raw source payloads (e.g. coinbase JSON), so
 * fall back to exact/containment quote match and then to semantic token overlap.
 */
function findModelCandidate(raw: AgentEvidenceCandidate[], rule: EvidenceCandidate): AgentEvidenceCandidate | undefined {
  return raw.find((item) => item.source_candidate_id === rule.candidate_id)
    ?? raw.find((item) => Boolean(item.original_quote && rule.original_quote)
      && (item.original_quote === rule.original_quote
        || item.original_quote.includes(rule.original_quote)
        || rule.original_quote.includes(item.original_quote)))
    ?? raw.find((item) => {
      const itemTokens = candidateTokens(`${item.original_quote} ${item.supported_fact ?? ''}`);
      const ruleTokens = candidateTokens(`${rule.original_quote} ${rule.suggested_evidence.event_title ?? ''} ${rule.suggested_evidence.event_summary ?? ''}`);
      return overlapCount(itemTokens, ruleTokens) >= MODEL_MATCH_TOKEN_THRESHOLD;
    });
}

/** Tokens that carry no identifying signal for fact-to-fact matching. */
const MODEL_MATCH_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'at', 'by', 'from', 'with',
  'is', 'are', 'was', 'were', 'be', 'this', 'that', 'it', 'as', 'not', 'no', 'has', 'have',
  'had', 'will', 'would', 'can', 'could', 'should', 'about', 'over', 'under', 'into', 'after',
  'market', 'cap', 'rank', 'trending', 'spot', 'price', 'source', 'record', 'symbol', 'name',
  'id', 'base', 'currency', 'amount', 'thumb', 'small', 'large', 'standard', 'images', 'image',
  'https', 'http', 'coingecko', 'coinbase', 'png', 'jpg', 'coin', 'search', 'signal', 'public',
  'quote', 'value', 'data', 'time', 'updated', 'api', 'response', 'payload', 'object', 'array',
  'item', 'list', 'top', 'new', 'day', 'week', 'hour', 'min', 'sec', '24h', 'percent', 'pct',
  'gainers', 'marketcap', 'usd', 'btcusd',
]);

const MODEL_MATCH_TOKEN_THRESHOLD = 2;

/** Splits text into identifying tokens: letter-bearing words and Chinese runs. */
function candidateTokens(text: string): Set<string> {
  const set = new Set<string>();
  for (const token of text.toLowerCase().match(/[a-z][a-z0-9]*|[\u4e00-\u9fff]{2,}/g) ?? []) {
    if (!MODEL_MATCH_STOPWORDS.has(token)) set.add(token);
  }
  return set;
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) if (b.has(token)) count += 1;
  return count;
}

/**
 * Builds the nested EvidenceImportDraft for a model candidate. Models commonly
 * return flat fields (`core_topic`, `branch_id`, `scope`, `evidence_strength`,
 * `quote`, …) instead of the nested `suggested_evidence` object; this merges
 * flat + nested + rule fallback so the model's topic/branch recognition is
 * never silently replaced by the rule candidate's `unknown_topic`.
 */
export function buildSuggestedEvidence(raw: Record<string, unknown>, rule: EvidenceCandidate | undefined): EvidenceImportDraft | null {
  const fallback = rule?.suggested_evidence;
  const nested = (raw.suggested_evidence && typeof raw.suggested_evidence === 'object'
    ? raw.suggested_evidence
    : null) as Partial<EvidenceImportDraft> | null;
  const pick = (sources: Array<unknown>): string | null => {
    for (const source of sources) {
      if (typeof source === 'string' && source.trim()) return source;
    }
    return null;
  };

  const topicId = pick([nested?.topic_id, raw.core_topic, raw.topic_id]) ?? fallback?.topic_id ?? 'unknown_topic';
  const branchId = pick([nested?.branch_id, raw.branch_id]) ?? null;
  const scopeRaw = nested?.scope ?? raw.scope;
  const scope: EvidenceImportDraft['scope'] = scopeRaw === 'branch' ? 'branch' : scopeRaw === 'parent' ? 'parent' : branchId ? 'branch' : fallback?.scope ?? 'parent';
  const strengthRaw = nested?.evidence_strength ?? raw.evidence_strength;
  const strength: EvidenceImportDraft['evidence_strength'] = (['E0', 'E1', 'E2', 'E3', 'E4'] as const).includes(strengthRaw as EvidenceImportDraft['evidence_strength'])
    ? strengthRaw as EvidenceImportDraft['evidence_strength']
    : fallback?.evidence_strength ?? 'E1';
  const sourceTypeRaw = nested?.source_type ?? raw.source_type;
  const sourceType: EvidenceImportDraft['source_type'] = (['official', 'filing', 'news', 'research', 'academic', 'company', 'other'] as const).includes(sourceTypeRaw as EvidenceImportDraft['source_type'])
    ? sourceTypeRaw as EvidenceImportDraft['source_type']
    : fallback?.source_type ?? 'news';
  const stageEffectRaw = nested?.stage_effect ?? raw.stage_effect;
  const stageEffect: EvidenceImportDraft['stage_effect'] = (['upgrade', 'maintain', 'downgrade', 'watch_upgrade', 'split_branch', 'no_change'] as const).includes(stageEffectRaw as EvidenceImportDraft['stage_effect'])
    ? stageEffectRaw as EvidenceImportDraft['stage_effect']
    : fallback?.stage_effect ?? 'maintain';
  const polarityRaw = nested?.polarity ?? raw.polarity;
  const polarity: EvidenceImportDraft['polarity'] = (['positive', 'negative', 'mixed', 'neutral'] as const).includes(polarityRaw as EvidenceImportDraft['polarity'])
    ? polarityRaw as EvidenceImportDraft['polarity']
    : fallback?.polarity ?? 'neutral';
  const confidenceRaw = nested?.confidence ?? raw.confidence;
  const confidence: EvidenceImportDraft['confidence'] = (['low', 'medium', 'high'] as const).includes(confidenceRaw as EvidenceImportDraft['confidence'])
    ? confidenceRaw as EvidenceImportDraft['confidence']
    : fallback?.confidence ?? 'medium';
  const affectedLayer = nested?.affected_layer?.length
    ? nested.affected_layer as EvidenceImportDraft['affected_layer']
    : Array.isArray(raw.affected_layer) && raw.affected_layer.length
      ? raw.affected_layer as EvidenceImportDraft['affected_layer']
      : fallback?.affected_layer ?? ['name'];
  const eventDate = pick([nested?.event_date, raw.event_date]) ?? fallback?.event_date ?? new Date().toISOString().slice(0, 10);

  return {
    evidence_id: fallback?.evidence_id ?? `evidence_agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    topic_id: topicId,
    branch_id: branchId,
    scope,
    event_date: eventDate,
    available_at: fallback?.available_at ?? eventDate,
    event_title: pick([nested?.event_title, raw.event_title])
      ?? fallback?.event_title
      ?? (pick([raw.original_quote, raw.supported_fact]) ?? '').replace(/\s+/g, ' ').slice(0, 96),
    event_summary: pick([nested?.event_summary, raw.event_summary])
      ?? fallback?.event_summary
      ?? [raw.supported_fact, raw.inferred_interpretation, raw.original_quote].filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join(' '),
    event_type: pick([nested?.event_type, raw.event_type]) ?? fallback?.event_type ?? 'WORLDMONITOR_SIGNAL',
    source_name: pick([nested?.source_name, raw.source_name]) ?? fallback?.source_name ?? 'unknown',
    source_url: pick([nested?.source_url, raw.source_url]) ?? fallback?.source_url ?? null,
    source_type: sourceType,
    evidence_strength: strength,
    affected_layer: affectedLayer,
    stage_effect: stageEffect,
    polarity,
    interpretation: pick([nested?.interpretation, raw.interpretation, raw.inferred_interpretation]) ?? fallback?.interpretation ?? 'Operator must separate fact from interpretation.',
    limitation: pick([nested?.limitation, raw.limitation]) ?? fallback?.limitation ?? 'Agent output requires human review.',
    confidence,
  };
}

/**
 * Resolves valid quote offsets. The model reports offsets against the truncated
 * prompt text, which can be negative or out of bounds for the real document, so
 * the quote's actual position in the raw text wins; provenance and 0-based
 * values are only fallbacks. Result always satisfies start >= 0 and end > start.
 */
function resolveQuoteOffsets(quote: string, rawText: string, modelStart: unknown, modelEnd: unknown, provenance?: { quote_start_offset: number; quote_end_offset: number }): { start: number; end: number } {
  const textLength = rawText.length;
  const index = quote ? rawText.indexOf(quote) : -1;
  if (index >= 0) {
    return { start: index, end: Math.min(textLength, index + Math.max(quote.length, 1)) };
  }
  const ms = typeof modelStart === 'number' && Number.isInteger(modelStart) ? modelStart : -1;
  const me = typeof modelEnd === 'number' && Number.isInteger(modelEnd) ? modelEnd : -1;
  const pStart = provenance?.quote_start_offset ?? 0;
  const pEnd = provenance?.quote_end_offset ?? pStart + 1;
  const start = Math.max(0, Math.min(ms >= 0 ? ms : pStart, Math.max(0, textLength - 1)));
  const end = Math.min(textLength, Math.max(me > start ? me : pEnd, start + 1));
  return { start, end };
}

function normalizeModelCandidate(raw: Record<string, unknown>, index: number, session: EvidenceIntakeSession, config: OpenAiCompatibleAgentConfig): AgentEvidenceCandidate | null {
  const explicitSourceId = typeof raw.source_candidate_id === 'string' ? raw.source_candidate_id : typeof raw.candidate_id === 'string' ? raw.candidate_id : null;
  const modelQuote = typeof raw.original_quote === 'string' ? raw.original_quote : typeof raw.quote === 'string' ? raw.quote : typeof raw.exact_quote === 'string' ? raw.exact_quote : '';
  // The model usually invents its own ids and never echoes source_candidate_id,
  // so resolve the owning rule candidate by id AND by quote containment. When a
  // rule is matched, reuse its candidate_id so the analysis is applied to the
  // rule candidate instead of spawning a duplicate agent-only extra.
  const rule = session.candidates.find((item) => explicitSourceId !== null && item.candidate_id === explicitSourceId)
    ?? session.candidates.find((item) => Boolean(modelQuote && item.original_quote)
      && (item.original_quote === modelQuote || item.original_quote.includes(modelQuote) || modelQuote.includes(item.original_quote)))
    ?? (explicitSourceId ? undefined : session.candidates[index]);
  const evidence = buildSuggestedEvidence(raw, rule);
  if (!evidence) return null;
  const quote = modelQuote || rule?.original_quote || '';
  const provenance = session.provenance_records.find((item) => item.quote === quote);
  const sourceCandidateId = rule?.candidate_id ?? explicitSourceId ?? `agent_only_${session.raw_document.raw_document_id}_${index}`;
  const offsets = resolveQuoteOffsets(quote, session.raw_document.text, raw.quote_start_offset, raw.quote_end_offset, provenance);
  const alternatives = Array.isArray(raw.alternative_mappings) && raw.alternative_mappings.length
    ? raw.alternative_mappings as AgentEvidenceCandidate['alternative_mappings']
    : [{ topic_id: evidence?.topic_id ?? null, branch_id: evidence?.branch_id ?? null, scope: evidence?.scope ?? null, reason: 'Rule-based alternative retained for operator review.' }];
  const chainRelation = isEvidenceChainRelation(raw.chain_relation) ? raw.chain_relation : undefined;
  const targetEvidenceIds = Array.isArray(raw.target_evidence_ids)
    ? [...new Set(raw.target_evidence_ids.filter((value): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value)))].slice(0, 5)
    : undefined;
  const targetStageGate = isStageGate(raw.target_stage_gate) ? raw.target_stage_gate : undefined;
  return {
    agent_candidate_id: typeof raw.agent_candidate_id === 'string' ? raw.agent_candidate_id : `agent_${sourceCandidateId}`,
    source_candidate_id: sourceCandidateId,
    raw_document_id: typeof raw.raw_document_id === 'string' ? raw.raw_document_id : rule?.raw_document_id ?? session.raw_document.raw_document_id,
    chunk_id: typeof raw.chunk_id === 'string' ? raw.chunk_id : rule?.chunk_id ?? session.chunks[0]?.chunk_id ?? `chunk_${index}`,
    provenance_id: typeof raw.provenance_id === 'string' ? raw.provenance_id : rule?.provenance_id ?? provenance?.provenance_id ?? session.provenance_records[0]?.provenance_id ?? `provenance_${index}`,
    original_quote: quote,
    quote_start_offset: offsets.start,
    quote_end_offset: offsets.end,
    supported_fact: typeof raw.supported_fact === 'string' ? raw.supported_fact : typeof raw.fact === 'string' ? raw.fact : quote,
    inferred_interpretation: typeof raw.inferred_interpretation === 'string' ? raw.inferred_interpretation : evidence?.interpretation ?? 'Operator must separate fact from interpretation.',
    limitation: typeof raw.limitation === 'string' ? raw.limitation : evidence?.limitation ?? 'Agent output requires human review.',
    suggested_evidence: evidence,
    suggested_reason: typeof raw.suggested_reason === 'string' ? raw.suggested_reason : 'Model suggestion normalized to the Evidence Candidate contract.',
    uncertainty_notes: Array.isArray(raw.uncertainty_notes) && raw.uncertainty_notes.length ? raw.uncertainty_notes as string[] : ['Model output was normalized; operator must verify every field.'],
    alternative_mappings: alternatives,
    ...(chainRelation ? { chain_relation: chainRelation } : {}),
    ...(targetEvidenceIds?.length ? { target_evidence_ids: targetEvidenceIds } : {}),
    ...(targetStageGate ? { target_stage_gate: targetStageGate } : {}),
    industry_id: typeof raw.industry_id === 'string' ? raw.industry_id : suggestIndustry(`${quote}\n${session.raw_document.text}`).industry_id,
    industry_status: raw.industry_status === 'matched' || raw.industry_status === 'provisional' || raw.industry_status === 'unresolved' ? raw.industry_status : suggestIndustry(`${quote}\n${session.raw_document.text}`).status,
    provider: config.provider,
    model_version: config.model,
    prompt_version: INTAKE_AGENT_PROMPT_VERSION,
    validation_status: 'passed',
    validation_errors: [],
    fallback_used: false,
    human_review_required: true,
  };
}

function isEvidenceChainRelation(value: unknown): value is NonNullable<AgentEvidenceCandidate['chain_relation']> {
  return value === 'supports' || value === 'contradicts' || value === 'updates'
    || value === 'duplicates' || value === 'branch_only' || value === 'fills_gap';
}

function isStageGate(value: unknown): value is string {
  return value === 'stable_label' || value === 'reality_validation'
    || value === 'pricing_adoption' || value === 'capital_confirmation';
}

function fallbackCandidate(rule: EvidenceCandidate, session: EvidenceIntakeSession, config: OpenAiCompatibleAgentConfig, reason: string): AgentEvidenceCandidate {
  const provenance = session.provenance_records.find((item) => item.provenance_id === rule.provenance_id);
  const industry = suggestIndustry(`${rule.original_quote}\n${session.raw_document.text}`);
  return {
    agent_candidate_id: `agent_${rule.candidate_id}`,
    source_candidate_id: rule.candidate_id,
    raw_document_id: rule.raw_document_id,
    chunk_id: rule.chunk_id,
    provenance_id: rule.provenance_id,
    original_quote: rule.original_quote,
    quote_start_offset: provenance?.quote_start_offset ?? 0,
    quote_end_offset: provenance?.quote_end_offset ?? rule.original_quote.length,
    supported_fact: rule.original_quote,
    inferred_interpretation: rule.suggested_evidence.interpretation,
    limitation: rule.suggested_evidence.limitation,
    suggested_evidence: rule.suggested_evidence,
    suggested_reason: `Rule-based fallback: ${reason}`,
    uncertainty_notes: [...rule.uncertainty_notes, 'Agent unavailable; rule candidate requires human review.'],
    alternative_mappings: [{ topic_id: rule.suggested_evidence.topic_id, branch_id: rule.suggested_evidence.branch_id ?? null, scope: rule.suggested_evidence.scope, reason: 'Rule-based fallback mapping.' }],
    industry_id: industry.industry_id,
    industry_status: industry.status,
    provider: config.provider,
    model_version: config.model,
    prompt_version: INTAKE_AGENT_PROMPT_VERSION,
    validation_status: 'fallback',
    validation_errors: [reason],
    fallback_used: true,
    human_review_required: true,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}
