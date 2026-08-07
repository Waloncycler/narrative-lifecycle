import { describe, expect, it } from 'vitest';
import { buildEvidenceChainEntries } from '../src/domain/evidence_chain';
import { buildTopicDiscoveryProposals } from '../src/domain/topic_discovery';
import type { EvidenceNode } from '../src/domain/evidence';
import type { EvidenceIntakeSession } from '../src/types/intake';
import type { TopicRegistry, TopicResolutionAudit } from '../src/types/topic_resolution';

const registry: TopicRegistry = {
  canonical_topics: [{ topic_id: 'bci', topic_name: 'BCI', current_stage: 'S4', status: 'active' }],
  aliases: [],
  branches: [],
  provisional_topics: [],
  memory_topic_ids: ['bci'],
};

const session: EvidenceIntakeSession = {
  session_id: 'session_self_iterating',
  generated_at: '2026-08-03T00:00:00.000Z',
  raw_document: { raw_document_id: 'raw_self', source_name: 'test', source_kind: 'pasted_text', ingested_at: '2026-08-03T00:00:00.000Z', text: 'A new branch was validated.', character_count: 28 },
  chunks: [],
  provenance_records: [],
  candidates: [{
    candidate_id: 'candidate_branch', raw_document_id: 'raw_self', chunk_id: 'chunk_1', provenance_id: 'prov_1', original_quote: 'A new branch was validated.',
    suggested_evidence: {
      evidence_id: 'ev_branch_new', topic_id: 'bci', branch_id: 'bci_new_branch', scope: 'branch', event_date: '2026-08-03', available_at: '2026-08-03', event_title: 'New branch validation', event_summary: 'A new branch was validated.', event_type: 'validation', source_name: 'test', source_type: 'research', evidence_strength: 'E2', affected_layer: ['reality'], stage_effect: 'upgrade', polarity: 'positive', interpretation: 'Branch-only validation.', limitation: 'Does not validate the parent narrative.', confidence: 'medium',
    },
    suggested_reason: 'new branch', uncertainty_notes: ['operator must confirm'], field_explanations: {}, e_strength_rationale: 'E2', guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
  }],
  review_template: [],
};

const audit: TopicResolutionAudit = {
  audit_id: 'audit_self_iterating', generated_at: '2026-08-03T00:00:00.000Z', session_id: session.session_id,
  resolutions: [{ candidate_id: 'candidate_branch', status: 'new_branch', resolved_topic_id: 'bci', resolved_branch_id: 'bci_new_branch', provisional_topic_id: null, reason: 'New branch requires operator confirmation.', confidence: 'medium', audit_required: true, alternatives: [] }],
  unresolved_queue: [],
  registry_validation: { validation_id: 'validation_self', generated_at: '2026-08-03T00:00:00.000Z', status: 'passed', topic_count: 1, alias_count: 0, branch_count: 0, provisional_topic_count: 0, unresolved_count: 0, errors: [], warnings: [] },
  guardrail_check: { no_forced_mapping: true, provisional_topics_do_not_inherit_stage: true, topic_changes_require_audit: true, branch_changes_do_not_upgrade_parent: true },
};

const prior: EvidenceNode = {
  evidence_id: 'ev_bci_prior', topic_id: 'bci', branch_id: 'bci_new_branch', parent_or_branch: 'branch', event_date: '2026-07-20', available_at: '2026-07-20', event_title: 'Prior branch signal', event_type: 'signal', source_name: 'test', evidence_strength: 'E1', affected_layer: ['perception'], stage_effect: 'maintain',
};

describe('self-iterating topic and evidence proposals', () => {
  it('preserves new branch discovery as a human-review proposal', () => {
    const proposals = buildTopicDiscoveryProposals({ session, audit, registry, generatedAt: '2026-08-03T00:01:00.000Z' });
    expect(proposals[0]).toMatchObject({ kind: 'new_branch', status: 'pending', parent_topic_id: 'bci', proposed_branch_id: 'bci_new_branch', audit_required: true });
  });

  it('creates a branch-only evidence-chain update without touching the parent', () => {
    const entries = buildEvidenceChainEntries({ session, audit, existingEvidence: [prior], generatedAt: '2026-08-03T00:01:00.000Z' });
    expect(entries[0]).toMatchObject({ topic_id: 'bci', branch_id: 'bci_new_branch', scope: 'branch', relation: 'branch_only', prior_evidence_ids: ['ev_bci_prior'], status: 'candidate' });
    expect(entries[0].topic_id).toBe('bci');
    expect(entries[0].scope).not.toBe('parent');
    expect(entries[0].idempotency_key).toContain('bci_new_branch');
  });
});
