import { describe, expect, it } from 'vitest';
import type { EvidenceCandidate } from '../src/types/intake';
import type { TopicRegistry } from '../src/types/topic_resolution';
import { buildTopicResolutionAudit, resolveTopic, validateTopicRegistry } from '../src/domain/topic_resolver';

const registry: TopicRegistry = {
  canonical_topics: [
    { topic_id: 'bci', topic_name: 'BCI', current_stage: 'S4', status: 'active' },
    { topic_id: 'humanoid_robotics', topic_name: 'Humanoid robotics', current_stage: 'S5-S6', status: 'active' },
  ],
  aliases: [{ alias: 'neuro rehab', topic_id: 'bci', reason: 'Alias to BCI branch language.' }],
  branches: [{ branch_id: 'bci_medical_rehab', topic_id: 'bci', branch_name: 'medical rehabilitation', status: 'active' }],
  provisional_topics: [],
  memory_topic_ids: ['bci'],
};

function candidate(overrides: Partial<EvidenceCandidate['suggested_evidence']> = {}, quote = 'BCI parent evidence.'): EvidenceCandidate {
  return {
    candidate_id: `candidate_${overrides.topic_id ?? 'bci'}_${overrides.branch_id ?? 'parent'}`,
    raw_document_id: 'raw',
    chunk_id: 'chunk',
    provenance_id: 'prov',
    original_quote: quote,
    suggested_reason: 'test',
    uncertainty_notes: [],
    field_explanations: {},
    e_strength_rationale: 'test',
    suggested_evidence: {
      evidence_id: 'ev',
      topic_id: 'bci',
      branch_id: null,
      scope: 'parent',
      event_date: '2026-07-13',
      available_at: '2026-07-13',
      event_title: quote,
      event_summary: quote,
      event_type: 'test',
      source_name: 'test',
      source_type: 'research',
      evidence_strength: 'E2',
      affected_layer: ['name'],
      stage_effect: 'maintain',
      polarity: 'neutral',
      interpretation: 'test',
      limitation: 'test',
      confidence: 'low',
      ...overrides,
    },
    guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
  };
}

describe('topic resolver', () => {
  it('distinguishes existing topic, alias, new branch, reactivation, provisional, and unresolved', () => {
    expect(resolveTopic(candidate(), registry).status).toBe('existing_topic');
    expect(resolveTopic(candidate({ topic_id: 'neuro rehab' }, 'Neuro rehab customer validation.'), registry)).toMatchObject({ status: 'alias_of', resolved_topic_id: 'bci' });
    expect(resolveTopic(candidate({ scope: 'branch', branch_id: 'bci_sports_rehab' }, 'BCI sports rehab branch evidence.'), registry)).toMatchObject({ status: 'new_branch', resolved_topic_id: 'bci', resolved_branch_id: 'bci_sports_rehab' });
    expect(resolveTopic(candidate({ scope: 'branch', branch_id: 'bci_medical_rehab' }, 'Old theme reactivation returns in medical rehabilitation follow-up.'), registry)).toMatchObject({ status: 'reactivation', resolved_topic_id: 'bci' });
    expect(resolveTopic(candidate({ topic_id: 'fusion_energy', event_title: 'Fusion supply chain', event_summary: 'Fusion supply chain validation.' }, 'Fusion supply chain validation.'), registry)).toMatchObject({ status: 'new_provisional_topic', provisional_topic_id: 'provisional_fusion_energy' });
    expect(resolveTopic(candidate({ topic_id: 'provisional_synthetic_biology', branch_id: 'biofoundry_services', scope: 'branch' }, 'Synthetic biology biofoundry services are a distinct application branch.'), registry)).toMatchObject({ status: 'new_provisional_topic', provisional_topic_id: 'provisional_synthetic_biology', resolved_branch_id: 'biofoundry_services' });
    expect(resolveTopic(candidate({ topic_id: 'unknown_topic' }, 'Unclear note with ambiguous labels.'), registry)).toMatchObject({ status: 'unresolved', resolved_topic_id: null });
  });

  it('requires audit for topic mutations and keeps provisional topics from inheriting high stages', () => {
    const audit = buildTopicResolutionAudit({
      sessionId: 'session',
      candidates: [
        candidate({ topic_id: 'neuro rehab' }, 'Neuro rehab validation.'),
        candidate({ topic_id: 'unknown_topic' }, 'Ambiguous unresolved note.'),
      ],
      registry,
      generatedAt: '2026-07-13T00:00:00.000Z',
    });
    expect(audit.guardrail_check).toMatchObject({
      no_forced_mapping: true,
      provisional_topics_do_not_inherit_stage: true,
      topic_changes_require_audit: true,
      branch_changes_do_not_upgrade_parent: true,
    });
    expect(audit.unresolved_queue).toHaveLength(1);
    expect(validateTopicRegistry({ registry, generatedAt: '2026-07-13T00:00:00.000Z' }).status).toBe('passed');
  });
});
