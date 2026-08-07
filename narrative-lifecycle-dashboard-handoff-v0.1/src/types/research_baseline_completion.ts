import type { ResearchCoverageLayer } from './research_coverage';

export type BaselineCompletionKind = 'parent_evidence_baseline' | 'topic_name_verification' | 'branch_name_verification';

export interface ResearchBaselineCompletionItem {
  item_id: string;
  kind: BaselineCompletionKind;
  priority: 'high' | 'medium';
  topic_id: string;
  branch_id: string | null;
  display_name_zh: string;
  required_layers: ResearchCoverageLayer[];
  rationale: string;
  suggested_query: string;
  next_action: 'research_original_sources' | 'validate_market_name';
  evidence_eligibility: 'context_only';
}

/** A gap-directed research plan. It is deliberately not an Evidence table,
 * lifecycle result, registry mutation, or publication instruction. */
export interface ResearchBaselineCompletionReport {
  artifact_type: 'research_baseline_completion_report';
  schema_version: '1.0.0';
  producer_version: string;
  baseline_plan_id: string;
  generated_at: string;
  source_snapshot_id: string | null;
  items: ResearchBaselineCompletionItem[];
  summary: {
    parent_evidence_baseline_count: number;
    topic_name_verification_count: number;
    branch_name_verification_count: number;
    high_priority_count: number;
  };
  guardrail_check: {
    existing_stage_unchanged: true;
    no_auto_evidence_import: true;
    evidence_table_required_for_stage: true;
    parent_branch_separation: true;
    no_auto_registry_name_mutation: true;
    no_trading_advice: true;
  };
}
