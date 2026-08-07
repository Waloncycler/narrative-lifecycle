export type DirectSourceResearchStatus = 'completed' | 'degraded' | 'insufficient_coverage';

/** A source-page discovery record. It is never formal Evidence by itself. */
export interface DirectSourceResearchLead {
  lead_id: string;
  task_id: string;
  topic_id: string | null;
  branch_id: string | null;
  /** Present for a universe seed; it remains a provisional Topic candidate. */
  candidate_node_id?: string | null;
  source_id: string;
  source_name: string;
  title: string;
  url: string;
  snippet: string;
  published_at: string | null;
  evidence_eligibility: 'context_only';
  next_action: 'review_source';
}

export interface DirectSourceResearchQuery {
  query_id: string;
  task_id: string;
  source_id: string;
  source_name: string;
  query: string;
  status: 'completed' | 'skipped' | 'failed';
  result_count: number;
  error: string | null;
}

export interface DirectSourceResearchReport {
  artifact_type: 'direct_source_research_report';
  schema_version: '1.0.0';
  producer_version: string;
  research_id: string;
  generated_at: string;
  status: DirectSourceResearchStatus;
  queries: DirectSourceResearchQuery[];
  lead_count: number;
  leads: DirectSourceResearchLead[];
  guardrail_check: {
    direct_source_results_not_formal_evidence: true;
    original_source_url_required: true;
    evidence_table_required_for_stage: true;
    parent_branch_separation: true;
    no_auto_import: true;
    no_trading_advice: true;
  };
}
