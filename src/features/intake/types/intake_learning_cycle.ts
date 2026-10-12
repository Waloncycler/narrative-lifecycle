import type { AiShadowValidationReport, EvidenceIntakeSession, IntakeEvaluationReport } from '@/features/intake/types/intake';
import type { IntakeLearningProfile } from '@/features/intake/types/intake_learning';
import type { TopicResolutionAudit } from '@/features/narrative/types/topic_resolution';

export type LearningProposalKind = 'field_guidance' | 'topic_mapping' | 'rejection_pattern' | 'guardrail_warning';
export type LearningProposalStatus = 'collecting' | 'shadow_ready' | 'blocked';

export interface LearningProposal {
  proposal_id: string;
  kind: LearningProposalKind;
  target: string;
  observation_count: number;
  support_rate: number;
  status: LearningProposalStatus;
  rationale: string;
  example_candidate_ids: string[];
  allowed_effect: 'advisory_context_only' | 'auto_apply';
  requires_human_approval: boolean;
}

export interface ActiveLearningQueueItem {
  candidate_id: string;
  priority_score: number;
  priority_band: 'low' | 'medium' | 'high';
  components: {
    uncertainty: number;
    rule_agent_disagreement: number;
    historical_error_density: number;
    novelty: number;
    stage_impact_risk: number;
  };
  reasons: string[];
  required_action: 'review';
}

export interface LearningPromotionGate {
  metric: string;
  actual: number | string;
  threshold: string;
  passed: boolean;
}

export interface IntakeLearningCycle {
  cycle_id: string;
  cycle_version: 'v0.7.3';
  generated_at: string;
  profile_id: string;
  baseline_profile_id: string | null;
  source_evaluation_ids: string[];
  observed_session_count: number;
  observed_candidate_count: number;
  proposals: LearningProposal[];
  active_learning_queue: ActiveLearningQueueItem[];
  promotion_gates: LearningPromotionGate[];
  promotion_status: 'insufficient_history' | 'blocked' | 'auto_eligible';
  rollback_profile_id: string | null;
  next_cycle_actions: string[];
  guardrail_check: {
    advisory_only: boolean;
    no_auto_rule_mutation: boolean;
    no_auto_stage_change: boolean;
    no_auto_topic_activation: boolean;
    no_auto_import: boolean;
    parent_branch_separation: true;
    no_trading_advice: true;
  };
}

export interface LearningCycleInput {
  profile: IntakeLearningProfile;
  previousProfile: IntakeLearningProfile | null;
  session: EvidenceIntakeSession;
  evaluation: IntakeEvaluationReport;
  topicAudit: TopicResolutionAudit | null;
  shadowReport: AiShadowValidationReport | null;
  generatedAt: string;
}
