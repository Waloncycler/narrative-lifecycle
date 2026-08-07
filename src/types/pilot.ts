import type { ArtifactMetadata } from './artifact_contract';

export type PilotBand = 'low' | 'medium' | 'high';
export type PosteriorDirection = 'up' | 'down' | 'unchanged';
export type EventIntensity = 'low' | 'medium' | 'high' | 'burst';
export type TailStructure = 'normal' | 'right_tail_candidate' | 'left_tail_risk';
export type OperatorAgreement = 'agree' | 'disagree' | 'uncertain';
export type OutcomeStatus = 'pending' | 'confirmed' | 'weakened' | 'falsified';
export type PilotAction = 'observe' | 'wait' | 'validate' | 'review' | 'monitor' | 'flag_risk';
export type PilotMetricValue = number | 'insufficient_history';

export interface PilotTopic {
  topic_id: string;
  current_hypothesis: string;
  competing_hypothesis: string;
  current_stage: string;
  prior_band: PilotBand;
  posterior_direction: PosteriorDirection;
  event_intensity: EventIntensity;
  tail_structure: TailStructure;
  strongest_evidence_ids: string[];
  why_not_higher_stage: string;
  falsification_trigger: string;
  next_validation_window: string;
  operator_agreement: OperatorAgreement;
  operator_comment: string;
  outcome_status: OutcomeStatus;
}

export interface PilotObservation {
  topic_id: string;
  run_id?: string;
  posterior_direction?: PosteriorDirection;
  event_intensity?: EventIntensity;
  tail_structure?: TailStructure;
  operator_agreement?: OperatorAgreement;
  operator_comment?: string;
  outcome_status?: OutcomeStatus;
  missed_change?: boolean;
}

export interface PilotLedgerEntry extends PilotTopic {
  latest_artifact_stage: string | null;
  diff_change_type: string | null;
  diff_detected_changes: string[];
  branch_mutation_detected: boolean;
  missed_change_detected: boolean;
  artifact_evidence_ids: string[];
  research_only_action: PilotAction;
  status_note: string;
}

export interface PilotEvaluationSummary {
  research_time_saved: PilotMetricValue;
  operator_agreement_rate: PilotMetricValue;
  stage_change_precision: PilotMetricValue;
  early_radar_follow_through: PilotMetricValue;
  false_positive_count: PilotMetricValue;
  missed_change_count: PilotMetricValue;
  falsification_count: PilotMetricValue;
  consecutive_no_change_runs: PilotMetricValue;
}

export interface PilotResearchLedger extends ArtifactMetadata {
  ledger_id: string;
  status: 'ok' | 'insufficient_history';
  source_artifacts: string[];
  pilot_topic_count: number;
  ledger_entries: PilotLedgerEntry[];
  evaluation_summary: PilotEvaluationSummary;
  guardrail_check: {
    no_trading_advice: boolean;
    required_hypotheses_present: boolean;
    required_falsification_triggers_present: boolean;
    research_only_actions: boolean;
    branch_parent_separation_preserved: boolean;
  };
}
