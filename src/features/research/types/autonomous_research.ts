import type { EvidenceImportDraft, EvidenceValidationReport } from '@/features/evidence/types/evidence_import';
import type { StageDiff, StageSnapshotHistory } from '@/features/stages/types/diff';
import type { WeeklyBrief } from '@/features/reporting/types/report';
import type { RunManifest } from '@/platform/types/run_context';

export type AutonomousPromotionDecision = 'published' | 'held' | 'rejected';
/**
 * `review_required` is the normal operator workflow. `policy_auto` is only
 * available when both the caller and the versioned policy explicitly opt in.
 */
export type EvidencePublicationMode = 'review_required' | 'policy_auto';

export interface AutonomousResearchPolicy {
  policy_id: string;
  enabled: boolean;
  auto_register_provisional_topics: boolean;
  auto_register_watch_branches: boolean;
  /** A discovered direction remains S0 until this evidence-only threshold passes. */
  auto_promote_provisional_topics: boolean;
  /** A branch is activated independently; this never changes its parent Stage. */
  auto_activate_watch_branches: boolean;
  minimum_independent_sources_for_topic_activation: number;
  minimum_independent_sources_for_branch_activation: number;
  require_parent_evidence_for_topic_activation: boolean;
  auto_publish_evidence: boolean;
  auto_recompute_stage: boolean;
  require_model_validation: boolean;
  /**
   * A deterministic source parser may publish a provenance-complete official
   * fact when the model transport is unavailable. This never applies to news
   * or unverified pasted material.
   */
  allow_rule_verified_publication: boolean;
  minimum_evidence_strength: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
  minimum_confidence: 'low' | 'medium' | 'high';
  permitted_source_types: Array<'official' | 'filing' | 'news' | 'research' | 'academic' | 'company' | 'other'>;
  allow_news_auto_publish: boolean;
  require_source_url: boolean;
  require_provenance: boolean;
  hold_parent_branch_risk: boolean;
  hold_conflicting_evidence: boolean;
  hold_stage_jump_above: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';
}

export interface AutonomousPromotionItem {
  candidate_id: string;
  evidence_id: string;
  topic_id: string | null;
  branch_id: string | null;
  scope: 'parent' | 'branch' | null;
  decision: AutonomousPromotionDecision;
  reasons: string[];
}

export interface AutonomousPromotionReport {
  artifact_type: 'autonomous_promotion_report';
  schema_version: '1.0.0';
  producer_version: string;
  run_id: string;
  generated_at: string;
  session_id: string | null;
  policy_id: string;
  model_status: 'passed' | 'fallback' | 'failed' | 'not_run';
  publication_mode: EvidencePublicationMode;
  publication_requested: boolean;
  candidate_count: number;
  published_count: number;
  held_count: number;
  rejected_count: number;
  published_evidence_ids: string[];
  items: AutonomousPromotionItem[];
  validation: EvidenceValidationReport | null;
  guardrail_check: {
    evidence_table_required: true;
    stage_first_score_second: true;
    parent_branch_separation: true;
    no_trading_advice: true;
    provenance_required: boolean;
    model_validation_required: boolean;
    human_review_required: boolean;
    automatic_publication_enabled: boolean;
  };
}

export interface AutonomousResearchRun {
  report: AutonomousPromotionReport;
  graph_promotion: import('@/features/narrative/types/narrative_graph_promotion').NarrativeGraphPromotionReport;
  snapshot: StageSnapshotHistory;
  diff: StageDiff;
  weekly_brief: WeeklyBrief;
  manifest: RunManifest;
}
