import { describe, expect, it } from 'vitest';
import { buildIntakeLearningCycle } from '@/domain/intake_learning_cycle';
import type { AiShadowValidationReport, EvidenceIntakeSession, IntakeEvaluationReport } from '@/types/intake';
import type { IntakeLearningProfile } from '@/types/intake_learning';
import type { TopicResolutionAudit } from '@/types/topic_resolution';

const session: EvidenceIntakeSession = {
  session_id: 'session_cycle',
  generated_at: '2026-07-27T00:00:00.000Z',
  raw_document: { raw_document_id: 'raw_cycle', source_name: 'cycle', source_kind: 'pasted_text', ingested_at: '2026-07-27T00:00:00.000Z', text: 'A branch received regulatory approval.', character_count: 38 },
  chunks: [],
  provenance_records: [],
  candidates: [{
    candidate_id: 'candidate_cycle',
    raw_document_id: 'raw_cycle',
    chunk_id: 'chunk_cycle',
    provenance_id: 'prov_cycle',
    original_quote: 'A branch received regulatory approval.',
    suggested_evidence: {
      evidence_id: 'ev_cycle',
      topic_id: 'topic',
      branch_id: 'branch',
      scope: 'branch',
      event_date: '2026-07-27',
      available_at: '2026-07-27',
      event_title: 'Branch approval',
      event_summary: 'A branch received regulatory approval.',
      event_type: 'regulation',
      source_name: 'regulator',
      source_url: 'https://example.invalid',
      source_type: 'official',
      evidence_strength: 'E4',
      affected_layer: ['reality'],
      stage_effect: 'upgrade',
      polarity: 'positive',
      interpretation: 'Hard reality evidence for the branch only.',
      limitation: 'Does not validate the parent narrative.',
      confidence: 'low',
    },
    suggested_reason: 'Rule candidate',
    uncertainty_notes: ['Topic requires review', 'Branch requires review'],
    field_explanations: {},
    e_strength_rationale: 'Regulatory approval is E4.',
    guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
  }],
  candidate_comparisons: [{
    candidate_id: 'candidate_cycle',
    rule_topic_id: 'topic',
    ai_topic_id: 'other_topic',
    rule_branch_id: 'branch',
    ai_branch_id: null,
    rule_scope: 'branch',
    ai_scope: 'parent',
    rule_strength: 'E4',
    ai_strength: 'E3',
    rule_layers: ['reality'],
    ai_layers: ['name'],
    rule_limitation: 'Does not validate the parent narrative.',
    ai_limitation: 'unclear',
    differs: true,
    difference_summary: 'different',
    human_decision_required: true,
  }],
  review_template: [],
};

const evaluation: IntakeEvaluationReport = {
  evaluation_id: 'evaluation_cycle',
  generated_at: '2026-07-27T00:01:00.000Z',
  session_id: session.session_id,
  candidate_count: 1,
  acceptance_rate: 0,
  modification_rate: 1,
  rejection_rate: 0,
  split_rate: 0,
  field_accuracy: 0.8,
  average_review_time_seconds: 30,
  duplicate_prevention_count: 0,
  parent_branch_error_rate: 0,
  ai_shadow_difference_count: 1,
  feedback: [],
  unresolved_candidate_ids: [],
  guardrail_check: { human_review_required: true, no_trading_advice: true, ai_shadow_only: true, no_auto_topic_activation: true },
};

const topicAudit: TopicResolutionAudit = {
  audit_id: 'audit_cycle',
  generated_at: '2026-07-27T00:00:00.000Z',
  session_id: session.session_id,
  resolutions: [{
    candidate_id: 'candidate_cycle',
    status: 'new_branch',
    resolved_topic_id: 'topic',
    resolved_branch_id: 'branch',
    provisional_topic_id: null,
    reason: 'new branch',
    confidence: 'medium',
    audit_required: true,
    alternatives: [],
  }],
  unresolved_queue: [],
  registry_validation: { validation_id: 'validation_cycle', generated_at: '2026-07-27T00:00:00.000Z', status: 'passed', topic_count: 1, alias_count: 0, branch_count: 1, provisional_topic_count: 0, unresolved_count: 0, errors: [], warnings: [] },
  guardrail_check: { no_forced_mapping: true, provisional_topics_do_not_inherit_stage: true, topic_changes_require_audit: true, branch_changes_do_not_upgrade_parent: true },
};

function profile(candidateCount = 3): IntakeLearningProfile {
  return {
    profile_id: 'profile_cycle',
    profile_version: 'v0.6.2',
    generated_at: '2026-07-27T00:02:00.000Z',
    source_evaluation_ids: ['evaluation_cycle'],
    observed_session_count: 3,
    observed_candidate_count: candidateCount,
    field_corrections: [{ field: 'topic_id', correction_count: 3, example_candidate_ids: ['a', 'b', 'c'] }],
    topic_corrections: [],
    rejection_patterns: [],
    split_count: 0,
    guardrail_incidents: { parent_branch_errors: 0, duplicate_hits: 0, trading_advice_attempts: 0 },
    adaptation_mode: 'advisory_only',
    auto_rule_mutation: false,
    auto_stage_change: false,
    auto_topic_activation: false,
  };
}

function shadowReport(): AiShadowValidationReport {
  return {
    report_id: 'shadow_cycle',
    generated_at: '2026-07-27T00:02:00.000Z',
    baseline_version: 'v0.5.6-rule-baseline',
    document_count: 50,
    rule_only_candidate_count: 50,
    ai_candidate_count: 50,
    fallback_count: 0,
    invalid_output_count: 0,
    precision: 0.96,
    recall: 0.9,
    unsupported_claim_rate: 0.01,
    citation_accuracy: 0.97,
    topic_branch_accuracy: 0.96,
    e3_e4_overstatement_count: 0,
    average_review_time_seconds: 20,
    field_modification_rate: 0.1,
    final_user_selection: { ai: 30, rule: 20 },
    guardrail_check: { schema_validated: true, citation_checked: true, parent_branch_checked: true, e_strength_checked: true, no_trading_advice: true, fallback_to_rule_based: true, secrets_not_persisted: true },
  };
}

describe('governed intake active learning cycle', () => {
  it('prioritizes high-risk disagreement and auto-applies shadow-ready proposals', () => {
    const cycle = buildIntakeLearningCycle({ profile: profile(), previousProfile: null, session, evaluation, topicAudit, shadowReport: shadowReport(), generatedAt: '2026-07-27T00:03:00.000Z' });
    expect(cycle.active_learning_queue[0].priority_band).toBe('high');
    expect(cycle.active_learning_queue[0].components.stage_impact_risk).toBe(100);
    expect(cycle.proposals[0]).toMatchObject({ status: 'shadow_ready', allowed_effect: 'auto_apply', requires_human_approval: false });
    expect(cycle.promotion_status).toBe('insufficient_history');
    expect(cycle.guardrail_check.no_auto_stage_change).toBe(false);
  });

  it('auto-approves promotion once all gates pass', () => {
    const previous = { ...profile(40), profile_id: 'profile_previous' };
    const cycle = buildIntakeLearningCycle({ profile: profile(50), previousProfile: previous, session, evaluation, topicAudit, shadowReport: shadowReport(), generatedAt: '2026-07-27T00:03:00.000Z' });
    expect(cycle.promotion_status).toBe('auto_eligible');
    expect(cycle.rollback_profile_id).toBe('profile_previous');
    expect(cycle.promotion_gates.every((gate) => gate.passed)).toBe(true);
  });

  it('blocks promotion when Parent/Branch errors exceed the gate', () => {
    const unsafeEvaluation = { ...evaluation, parent_branch_error_rate: 0.02 };
    const cycle = buildIntakeLearningCycle({ profile: profile(50), previousProfile: null, session, evaluation: unsafeEvaluation, topicAudit, shadowReport: shadowReport(), generatedAt: '2026-07-27T00:03:00.000Z' });
    expect(cycle.promotion_status).toBe('blocked');
    expect(cycle.promotion_gates.find((gate) => gate.metric === 'parent_branch_error_rate')?.passed).toBe(false);
  });
});
