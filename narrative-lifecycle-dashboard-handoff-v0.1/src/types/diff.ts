import type { ResearchSafeActionVerb, WeeklyBriefGuardrailCheck } from './report';
import type { ArtifactMetadata } from './artifact_contract';

export type DiffStage =
  | 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S4-S5'
  | 'S5' | 'S5-S6' | 'S6' | 'S6-S7A' | 'S7A' | 'S7B' | 'S7C';

export type DataConfidenceBand = 'low' | 'medium' | 'high';

export type TopicChangeType =
  | 'initial_snapshot'
  | 'no_change'
  | 'stage_upgrade'
  | 'stage_downgrade'
  | 'stage_band_change'
  | 'evidence_added'
  | 'evidence_removed'
  | 'evidence_changed'
  | 'why_not_higher_changed'
  | 'data_confidence_changed'
  | 'branch_change'
  | 'branch_mutation_candidate';

export interface StageSnapshotBranch {
  branch_id: string;
  branch_name: string;
  current_stage: string;
  evidence_ids: string[];
  reactivation_record_id: string | null;
}

export interface StageSnapshotTopic {
  topic_id: string;
  topic_name: string;
  parent_narrative: string;
  current_stage: string;
  gate_stage: string;
  max_allowed_stage: string;
  strongest_branch: string;
  weakest_layer: string;
  data_confidence: DataConfidenceBand;
  evidence_ids: string[];
  score_id: string;
  dashboard_card_id: string;
  why_not_higher_stage: string;
  gate_why_not_higher_stage: string;
  gate_evidence_ids: string[];
  branches: StageSnapshotBranch[];
}

export interface StageSnapshotRadarCandidate {
  candidate_id: string;
  candidate_topic: string;
  reactivation_record_id: string;
  evidence_ids: string[];
}

export interface StageSnapshotHistory extends ArtifactMetadata {
  snapshot_id: string;
  run_id: string;
  generated_at: string;
  source_report_id: string;
  topics: StageSnapshotTopic[];
  early_radar_candidates: StageSnapshotRadarCandidate[];
  guardrail_check: WeeklyBriefGuardrailCheck;
}

export interface TopicChange {
  topic_id: string;
  topic_name: string;
  change_type: TopicChangeType;
  detected_changes: TopicChangeType[];
  previous_stage: string | null;
  current_stage: string;
  previous_evidence_ids: string[];
  current_evidence_ids: string[];
  new_evidence_ids: string[];
  removed_evidence_ids: string[];
  previous_why_not_higher_stage: string | null;
  current_why_not_higher_stage: string;
  previous_data_confidence: DataConfidenceBand | null;
  current_data_confidence: DataConfidenceBand;
  change_reason: string;
  priority: 'low' | 'medium' | 'high';
  research_only_action: ResearchSafeActionVerb;
  branch_id: string | null;
  reactivation_record_id: string | null;
}

export interface RadarChange {
  candidate_id: string;
  candidate_topic: string;
  change_type: 'early_radar_added' | 'early_radar_removed';
  reactivation_record_id: string;
  evidence_ids: string[];
  priority: 'medium';
  research_only_action: ResearchSafeActionVerb;
}

export interface GuardrailChange {
  guardrail: keyof WeeklyBriefGuardrailCheck;
  change_type: 'guardrail_regression';
  previous_value: true;
  current_value: false;
  priority: 'high';
  research_only_action: ResearchSafeActionVerb;
}

export interface StageDiffSummary {
  topic_count: number;
  stage_upgrade_count: number;
  stage_downgrade_count: number;
  evidence_added_count: number;
  branch_mutation_candidate_count: number;
  guardrail_regression_count: number;
}

export interface StageDiff extends ArtifactMetadata {
  diff_id: string;
  run_id: string;
  generated_at: string;
  status: 'ok' | 'no_previous_snapshot';
  previous_snapshot_id: string | null;
  current_snapshot_id: string;
  summary: StageDiffSummary;
  topic_changes: TopicChange[];
  early_radar_changes: RadarChange[];
  guardrail_changes: GuardrailChange[];
  next_operator_actions: Array<{
    action: ResearchSafeActionVerb;
    topic_id?: string;
    reason: string;
    evidence_ids: string[];
  }>;
}
