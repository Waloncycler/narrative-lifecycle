import type { ResearchSafeActionVerb } from './report';
import type { ArtifactMetadata } from './artifact_contract';

export interface OperatorReviewRunEntry {
  run_id: string;
  started_at: string;
  completed_at: string;
  status: 'ok' | 'failed';
  guardrail_status: 'ok' | 'review_required';
  has_stage_diff: boolean;
  has_weekly_brief: boolean;
}

export interface OperatorReviewWindow {
  first_run_id: string | null;
  last_run_id: string | null;
  first_started_at: string | null;
  last_completed_at: string | null;
}

export interface OperatorReviewRunSummary {
  run_count: number;
  successful_run_count: number;
  failed_run_count: number;
}

export interface OperatorReviewTrendPoint {
  run_id: string;
  generated_at: string;
  topic_id?: string;
  topic_name?: string;
  change_type: string;
  previous_value?: string | null;
  current_value?: string | null;
  evidence_ids: string[];
  branch_id?: string | null;
  reactivation_record_id?: string | null;
}

export interface OperatorReviewFailureHit {
  run_id: string;
  status: 'failed' | 'review_required';
  issue: string;
  command?: string;
}

export interface OperatorReviewRepeatedIssue {
  issue: string;
  count: number;
  run_ids: string[];
}

export interface OperatorReviewNoChangeStreak {
  topic_id: string;
  topic_name: string;
  consecutive_run_count: number;
  run_ids: string[];
  current_stage: string;
}

export interface OperatorReviewAlert {
  priority: 'high' | 'medium';
  category: string;
  message: string;
  run_ids: string[];
  research_only_action: ResearchSafeActionVerb;
  evidence_ids: string[];
}

export interface OperatorReviewNextAction {
  action: ResearchSafeActionVerb;
  reason: string;
  run_ids: string[];
  evidence_ids: string[];
}

export interface OperatorReview extends ArtifactMetadata {
  review_id: string;
  generated_at: string;
  status: 'ok' | 'insufficient_history';
  source_artifacts: string[];
  review_window: OperatorReviewWindow;
  run_summary: OperatorReviewRunSummary;
  runs: OperatorReviewRunEntry[];
  stage_trends: {
    upgrades: OperatorReviewTrendPoint[];
    downgrades: OperatorReviewTrendPoint[];
  };
  evidence_trends: {
    added: OperatorReviewTrendPoint[];
    removed: OperatorReviewTrendPoint[];
  };
  why_not_higher_changes: OperatorReviewTrendPoint[];
  data_confidence_changes: OperatorReviewTrendPoint[];
  branch_mutation_changes: OperatorReviewTrendPoint[];
  early_radar_changes: OperatorReviewTrendPoint[];
  guardrail_regressions: OperatorReviewTrendPoint[];
  failure_case_hits: OperatorReviewFailureHit[];
  repeated_issues: OperatorReviewRepeatedIssue[];
  consecutive_no_change_topics: OperatorReviewNoChangeStreak[];
  high_priority_operator_alerts: OperatorReviewAlert[];
  research_only_next_actions: OperatorReviewNextAction[];
}
