import type { ArtifactMetadata } from './artifact_contract';
import type { StageDiff } from './diff';
import type { EvidenceNode } from '../domain/evidence';

export type ReplayScenarioType = 'success' | 'failure' | 's7b' | 's7c' | 'parent_branch_separation' | 'long_no_change';
export type ReplayOutcomeStatus = 'confirmed' | 'weakened' | 'falsified' | 'no_change';

export interface ReplayTimeSlice {
  slice_id: string;
  as_of: string;
}

export interface ReplayOutcome {
  revealed_at: string;
  status: ReplayOutcomeStatus;
  correct_stage: string;
  summary: string;
  outcome_evidence_ids: string[];
}

export interface ReplayCase {
  case_id: string;
  topic_id: string;
  topic_name: string;
  parent_narrative: string;
  scenario_type: ReplayScenarioType;
  requested_stage: string;
  data_confidence: number;
  branch_id?: string | null;
  slices: ReplayTimeSlice[];
  evidence: EvidenceNode[];
  outcome: ReplayOutcome;
  calibration_note: string;
}

export interface ReplayBranchResult {
  branch_id: string;
  current_stage: string;
  evidence_ids: string[];
}

export interface ReplaySliceResult {
  slice_id: string;
  as_of: string;
  evidence_ids_used: string[];
  future_evidence_excluded: string[];
  parent_stage: string;
  branch_stages: ReplayBranchResult[];
  why_not_higher_stage: string;
  early_radar_candidate_ids: string[];
  diff_change_type: string;
  diff_detected_changes: string[];
}

export interface ReplayCaseResult {
  case_id: string;
  topic_id: string;
  scenario_type: ReplayScenarioType;
  stage_path: ReplaySliceResult[];
  final_stage_before_outcome: string;
  outcome_status: ReplayOutcomeStatus;
  correct_stage: string;
  outcome_summary: string;
  misclassification: boolean;
  lead_time_days: number | 'missed' | 'not_applicable';
  missed_change: boolean;
  false_positive: boolean;
  parent_branch_separation_preserved: boolean;
  calibration_suggestion: string;
}

export interface ReplayLedger extends ArtifactMetadata {
  ledger_id: string;
  status: 'ok' | 'insufficient_history';
  source_artifacts: string[];
  case_count: number;
  replay_cases: ReplayCaseResult[];
  aggregate: {
    success_count: number;
    failure_count: number;
    misclassification_count: number;
    missed_change_count: number;
    false_positive_count: number;
    average_lead_time_days: number | 'insufficient_history';
    parent_branch_separation_preserved: boolean;
  };
  guardrail_check: {
    no_future_evidence_used: boolean;
    no_trading_advice: boolean;
    no_price_based_outcome_inference: boolean;
    parent_branch_separation_preserved: boolean;
  };
  debug_diffs: StageDiff[];
}
