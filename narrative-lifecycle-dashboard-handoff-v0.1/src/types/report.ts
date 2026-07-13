import type { ArtifactMetadata } from './artifact_contract';

export type ResearchSafeActionVerb =
  | 'observe'
  | 'track'
  | 'validate'
  | 'review'
  | 'monitor'
  | 'compare'
  | 'flag_risk'
  | 'request_more_evidence';

export interface WeeklyBriefExecutiveSummary {
  dashboard_card_count: number;
  score_count: number;
  golden_case_passed: number;
  golden_case_total: number;
  early_radar_candidate_count: number;
  system_status: 'ok' | 'review_required';
  rule_version?: string;
}

export interface WeeklyBriefStageSnapshot {
  topic_id: string;
  topic_name: string;
  current_stage: string;
  parent_narrative: string;
  strongest_branch: string;
  weakest_layer: string;
  data_confidence: number;
}

export interface WeeklyBriefStageChange {
  topic_id: string;
  topic_name: string;
  previous_stage: string | null;
  current_stage: string;
  change_type: string;
  detected_changes: string[];
  new_evidence_ids: string[];
  removed_evidence_ids: string[];
  change_reason: string;
  priority: 'low' | 'medium' | 'high';
  research_only_action: ResearchSafeActionVerb;
  branch_id: string | null;
  reactivation_record_id: string | null;
}

export interface WeeklyBriefStageChangeSummary {
  previous_snapshot_id: string | null;
  current_snapshot_id: string;
  upgrade_count: number;
  downgrade_count: number;
  evidence_added_count: number;
  branch_mutation_candidate_count: number;
  guardrail_regression_count: number;
}

export interface WeeklyBriefEvidenceItem {
  evidence_id: string;
  evidence_strength: string;
  affected_layer: string[];
  topic: string;
  interpretation: string;
}

export interface WeeklyBriefWhyNotHigher {
  topic_id: string;
  topic_name: string;
  current_stage: string;
  why_not_higher_stage: string;
  evidence_ids: string[];
}

export interface WeeklyBriefEarlyRadarCandidate {
  candidate_id: string;
  candidate_topic: string;
  reason: string;
  reactivation_record_id: string;
  evidence_ids: string[];
  research_only_action: string;
}

export interface WeeklyBriefGuardrailCheck {
  no_trading_advice: boolean;
  research_only_actions: boolean;
  parent_branch_separation_preserved: boolean;
  evidence_ids_visible: boolean;
  why_not_higher_present: boolean;
  data_confidence_present: boolean;
}

export interface WeeklyBriefNextOperatorAction {
  action: ResearchSafeActionVerb;
  topic_id?: string;
  reason: string;
  evidence_ids: string[];
}

export interface WeeklyBrief extends ArtifactMetadata {
  report_id: string;
  generated_at: string;
  source_artifacts: string[];
  executive_summary: WeeklyBriefExecutiveSummary;
  stage_snapshot: WeeklyBriefStageSnapshot[];
  stage_change_summary: WeeklyBriefStageChangeSummary;
  stage_changes: WeeklyBriefStageChange[];
  strongest_evidence: WeeklyBriefEvidenceItem[];
  why_not_higher: WeeklyBriefWhyNotHigher[];
  early_radar_candidates: WeeklyBriefEarlyRadarCandidate[];
  guardrail_check: WeeklyBriefGuardrailCheck;
  next_operator_actions: WeeklyBriefNextOperatorAction[];
  artifact_index: string[];
}
