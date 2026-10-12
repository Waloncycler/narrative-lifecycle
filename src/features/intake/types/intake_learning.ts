import type { ReviewDecisionKind } from '@/features/intake/types/intake';

export interface IntakeLearningFieldSignal {
  field: string;
  correction_count: number;
  example_candidate_ids: string[];
}

export interface IntakeLearningTopicSignal {
  from_topic_id: string | null;
  to_topic_id: string | null;
  from_branch_id: string | null;
  to_branch_id: string | null;
  count: number;
  example_candidate_ids: string[];
}

export interface IntakeLearningRejectionSignal {
  reason: string;
  count: number;
  example_candidate_ids: string[];
}

export interface IntakeLearningProfile {
  profile_id: string;
  profile_version: string;
  generated_at: string;
  source_evaluation_ids: string[];
  observed_session_count: number;
  observed_candidate_count: number;
  field_corrections: IntakeLearningFieldSignal[];
  topic_corrections: IntakeLearningTopicSignal[];
  rejection_patterns: IntakeLearningRejectionSignal[];
  split_count: number;
  guardrail_incidents: {
    parent_branch_errors: number;
    duplicate_hits: number;
    trading_advice_attempts: number;
  };
  adaptation_mode: 'advisory_only' | 'autonomous';
  auto_rule_mutation: boolean;
  auto_stage_change: boolean;
  auto_topic_activation: boolean;
}

export function learningProfileContext(profile: IntakeLearningProfile | null): string {
  if (!profile) return 'No prior operator feedback profile is available.';
  return JSON.stringify({
    mode: profile.adaptation_mode,
    common_field_corrections: profile.field_corrections.slice(0, 8),
    recurring_topic_corrections: profile.topic_corrections.slice(0, 8),
    rejection_patterns: profile.rejection_patterns.slice(0, 8),
    guardrail_incidents: profile.guardrail_incidents,
    instruction: 'Use this only to prioritize review warnings and alternatives. Do not change rules, registries, stages, scores, or import permission.',
  });
}
