import { describe, expect, it } from 'vitest';
import { RunIntakeAgentUseCase } from '@/app/use_cases/run_intake_agent_use_case';
import { buildTopicResolutionAudit } from '@/features/narrative/domain/topic_resolver';
import { chunkRawDocument, extractEvidenceCandidates } from '@/features/intake/domain/intake_rules';
import type { EvidenceIntakeSession, RawDocument } from '@/features/intake/types/intake';
import type { AgentEvidenceCandidate } from '@/features/intake/types/intake_agent';
import type { NarrativeDiscoveryReport } from '@/features/narrative/types/narrative_discovery';
import type { TopicRegistry, TopicResolutionAudit } from '@/features/narrative/types/topic_resolution';

const registry: TopicRegistry = {
  canonical_topics: [{ topic_id: 'humanoid_robotics', topic_name: 'Humanoid robotics', current_stage: 'S4', status: 'active' }],
  aliases: [], branches: [], provisional_topics: [], memory_topic_ids: [],
};

function sourceSession(): EvidenceIntakeSession {
  const text = 'Humanoid robotics warehouse logistics applications completed customer pilot validation.';
  const raw: RawDocument = { raw_document_id: 'raw_use_case', source_name: 'test', source_kind: 'pasted_text', ingested_at: '2026-08-03T00:00:00.000Z', text, character_count: text.length };
  const extracted = extractEvidenceCandidates({ rawDocument: raw, chunks: chunkRawDocument(raw), existingEvidenceIds: new Set(), generatedAt: raw.ingested_at });
  return { session_id: 'session_use_case', generated_at: raw.ingested_at, raw_document: raw, chunks: chunkRawDocument(raw), provenance_records: extracted.provenance, candidates: extracted.candidates, review_template: [] };
}

describe('narrative discovery intake integration', () => {
  it('turns a source-backed subtopic into a branch audit before the normal topic resolver and never maps it to parent scope', async () => {
    let session = sourceSession();
    const captured: { audit: TopicResolutionAudit | null; report: NarrativeDiscoveryReport | null; resolvedSession: EvidenceIntakeSession | null } = { audit: null, report: null, resolvedSession: null };
    const rule = session.candidates[0];
    const agentCandidate: AgentEvidenceCandidate = {
      agent_candidate_id: 'agent_1', source_candidate_id: rule.candidate_id, raw_document_id: rule.raw_document_id, chunk_id: rule.chunk_id, provenance_id: rule.provenance_id,
      original_quote: rule.original_quote, quote_start_offset: 0, quote_end_offset: rule.original_quote.length, supported_fact: rule.original_quote,
      inferred_interpretation: 'Warehouse logistics is a distinct application and requires a separate branch review.', limitation: rule.suggested_evidence.limitation,
      suggested_evidence: rule.suggested_evidence, suggested_reason: 'Rule fallback.', uncertainty_notes: ['review'], alternative_mappings: [], provider: 'disabled', model_version: 'none', prompt_version: 'test', validation_status: 'fallback', validation_errors: ['disabled'], fallback_used: true, human_review_required: true,
    };
    const useCase = new RunIntakeAgentUseCase({
      prepare: () => session, readLatest: () => session, readIndustryPacks: () => [], readLearningProfile: () => null, readTopicRegistry: () => registry,
      readTopicResolutionAudit: () => captured.audit, readEvidenceNodes: () => [], readDiff: () => null,
      generate: async () => ({ candidates: [agentCandidate], audit: { audit_id: 'agent_audit', generated_at: '2026-08-03T00:00:00.000Z', session_id: session.session_id, provider: 'disabled', model_version: 'none', prompt_version: 'test', status: 'fallback', request_fingerprint: 'request', response_fingerprint: null, error: 'disabled', secret_redaction: 'api_key_not_persisted' } }),
      writeTopicDiscoveryProposals: () => undefined, writeEvidenceChain: () => undefined,
      readNarrativeDiscoveryRecords: () => [], writeNarrativeDiscovery: (value) => { captured.report = value; },
      writeSession: (value) => { session = value; },
      resolveTopics: (value) => { captured.resolvedSession = value; captured.audit = buildTopicResolutionAudit({ sessionId: value.session_id, candidates: value.candidates, registry, generatedAt: '2026-08-03T00:00:00.000Z' }); },
      write: () => undefined, validateCandidate: () => undefined, validateVerification: () => undefined, validateNarrativeDiscovery: () => undefined,
      now: () => '2026-08-03T00:00:00.000Z',
    });

    await useCase.execute({ text: session.raw_document.text });
    expect(captured.report?.records[0]).toMatchObject({ resolution: 'new_branch', topic_id: 'humanoid_robotics', scope: 'branch', registration_action: 'watch_branch' });
    expect(captured.resolvedSession?.candidates[0].suggested_evidence).toMatchObject({ topic_id: 'humanoid_robotics', scope: 'branch', stage_effect: 'split_branch' });
    expect(captured.audit?.resolutions[0]).toMatchObject({ status: 'new_branch', resolved_topic_id: 'humanoid_robotics' });
  });
});
