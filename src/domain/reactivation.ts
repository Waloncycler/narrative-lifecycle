import type { ReactivationType } from '../rules/reactivation_rules';

export interface NarrativeMemory {
  topic_id: string;
  first_seen_date?: string;
  last_active_date?: string;
  historical_stage_path?: string[];
  previous_peak_stage?: string;
  previous_failed_transition?: string;
  previous_failure_reason?: string;
  previous_missing_evidence?: string[];
  previous_friction_points?: string[];
  previous_branch_structure?: string[];
  is_failure_case?: boolean;
  memory_confidence?: number;
}

export interface ReactivationRecord {
  record_id: string;
  topic_id: string;
  event_id?: string;
  reactivation_type: ReactivationType;
  narrative_delta_score: number;
  missing_evidence_filled: string[];
  branch_mutation_detected: boolean;
  expectation_reset_detected: boolean;
  old_story_repetition_risk: number;
  should_enter_radar: boolean;
}
