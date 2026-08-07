import { describe, expect, it } from 'vitest';
import { buildIntakeLearningProfile } from '../src/domain/intake_learning';
import type { EvidenceIntakeSession, IntakeEvaluationReport, ReviewDecision } from '../src/types/intake';

const session: EvidenceIntakeSession = {
  session_id: 'session_learning',
  generated_at: '2026-07-27T00:00:00.000Z',
  raw_document: { raw_document_id: 'raw_learning', source_name: 'learning test', source_kind: 'pasted_text', ingested_at: '2026-07-27T00:00:00.000Z', text: 'The branch was validated.', character_count: 26 },
  chunks: [],
  provenance_records: [],
  candidates: [{
    candidate_id: 'candidate_learning', raw_document_id: 'raw_learning', chunk_id: 'chunk_1', provenance_id: 'prov_1', original_quote: 'The branch was validated.',
    suggested_evidence: { evidence_id: 'ev_learning', topic_id: 'old_topic', branch_id: 'old_branch', scope: 'branch', event_date: '2026-07-27', available_at: '2026-07-27', event_title: 'Branch validation', event_summary: 'The branch was validated.', event_type: 'validation', source_name: 'learning test', source_url: 'https://example.invalid', source_type: 'research', evidence_strength: 'E2', affected_layer: ['reality'], stage_effect: 'maintain', polarity: 'positive', interpretation: 'Old interpretation', limitation: 'Needs review', confidence: 'low' },
    suggested_reason: 'Rule suggestion', uncertainty_notes: ['review'], field_explanations: {}, e_strength_rationale: 'E2', duplicate_of_evidence_id: null, guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
  }],
  review_template: [],
};

const evaluation: IntakeEvaluationReport = {
  evaluation_id: 'evaluation_learning', generated_at: '2026-07-27T00:01:00.000Z', session_id: session.session_id, candidate_count: 1, acceptance_rate: 0, modification_rate: 1, rejection_rate: 0, split_rate: 0, field_accuracy: 0.5, average_review_time_seconds: 30, duplicate_prevention_count: 0, parent_branch_error_rate: 0, ai_shadow_difference_count: 1, unresolved_candidate_ids: [],
  feedback: [{ candidate_id: 'candidate_learning', final_decision: 'modify', modified_fields: ['topic_id', 'branch_id', 'limitation'], rejection_reason: null, review_duration_seconds: 30, duplicate_hit: false, parent_branch_error: false, field_accuracy: 0.5 }],
  guardrail_check: { human_review_required: true, no_trading_advice: true, ai_shadow_only: true, no_auto_topic_activation: true },
};

describe('intake learning profile', () => {
  it('learns from corrections and enables autonomous adaptation', () => {
    const decisions: ReviewDecision[] = [{ candidate_id: 'candidate_learning', decision: 'modify', reviewer: 'operator', reviewed_at: '2026-07-27T00:01:00.000Z', modified_evidence: { ...session.candidates[0].suggested_evidence, topic_id: 'new_topic', branch_id: null, scope: 'parent', limitation: 'New limitation' } }];
    const profile = buildIntakeLearningProfile({ session, decisions, evaluation, generatedAt: '2026-07-27T00:02:00.000Z' });
    expect(profile.field_corrections.map((item) => item.field)).toEqual(expect.arrayContaining(['topic_id', 'branch_id', 'limitation']));
    expect(profile.topic_corrections[0]).toMatchObject({ from_topic_id: 'old_topic', to_topic_id: 'new_topic' });
    expect(profile.adaptation_mode).toBe('autonomous');
    expect(profile.auto_rule_mutation).toBe(true);
    expect(profile.auto_stage_change).toBe(true);
    expect(profile.auto_topic_activation).toBe(true);
  });

  it('accumulates distinct evaluations and ignores a repeated evaluation', () => {
    const decisions: ReviewDecision[] = [{ candidate_id: 'candidate_learning', decision: 'modify', reviewer: 'operator', reviewed_at: '2026-07-27T00:01:00.000Z', modified_evidence: { ...session.candidates[0].suggested_evidence, topic_id: 'new_topic', branch_id: null, scope: 'parent', limitation: 'New limitation' } }];
    const first = buildIntakeLearningProfile({ session, decisions, evaluation, generatedAt: '2026-07-27T00:02:00.000Z' });
    const repeated = buildIntakeLearningProfile({ session, decisions, evaluation, previous: first, generatedAt: '2026-07-27T00:03:00.000Z' });
    expect(repeated).toEqual(first);

    const secondEvaluation = { ...evaluation, evaluation_id: 'evaluation_learning_2' };
    const second = buildIntakeLearningProfile({ session, decisions, evaluation: secondEvaluation, previous: first, generatedAt: '2026-07-27T00:04:00.000Z' });
    expect(second.observed_session_count).toBe(2);
    expect(second.field_corrections.find((item) => item.field === 'topic_id')?.correction_count).toBe(2);
    expect(second.topic_corrections[0].count).toBe(2);
  });
});
