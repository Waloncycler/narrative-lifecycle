import type { ResearchCoverageLayer } from '@/features/research/types/research_coverage';
import type { Stage } from '@/features/stages/domain/stages';

export type HistoricalRecoveryKind = 'fill_stage_gap' | 'establish_parent_baseline' | 'repair_provenance';

/**
 * A research-only instruction derived from a trusted timeline gap. It is not
 * an Evidence row and therefore cannot alter a Stage, Score, Topic, or Branch.
 */
export interface HistoricalEvidenceRecoveryTask {
  task_id: string;
  kind: HistoricalRecoveryKind;
  priority: 'high' | 'medium';
  topic_id: string;
  topic_name: string;
  scope: 'parent';
  target_stages: Stage[];
  required_layers: ResearchCoverageLayer[];
  accepted_source_classes: Array<'official' | 'filing' | 'company' | 'academic' | 'reputable_news'>;
  search_intents: string[];
  rationale: string;
  intake_route: 'research_retrieve_then_intake_review';
  evidence_eligibility: 'context_only';
}

export interface HistoricalEvidenceRecoveryReport {
  artifact_type: 'historical_evidence_recovery_report';
  schema_version: '1.0.0';
  producer_version: string;
  recovery_plan_id: string;
  generated_at: string;
  /** Logical artifact identity; the filesystem path belongs to Infrastructure. */
  timeline_source: 'stage_evolution_timeline';
  status: 'ready_for_research' | 'insufficient_history';
  tasks: HistoricalEvidenceRecoveryTask[];
  summary: {
    topic_count: number;
    task_count: number;
    stage_gap_task_count: number;
    baseline_task_count: number;
    provenance_repair_task_count: number;
    high_priority_count: number;
  };
  guardrail_check: {
    timeline_is_read_only: true;
    existing_stage_unchanged: true;
    no_auto_evidence_import: true;
    evidence_table_required_for_stage: true;
    parent_branch_separation: true;
    no_auto_registry_mutation: true;
    no_trading_advice: true;
  };
}
