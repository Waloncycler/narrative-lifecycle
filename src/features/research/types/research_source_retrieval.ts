import type { ResearchLeadDisposition, ResearchLeadSourceClass } from '@/features/research/types/research_lead_triage';

export interface SourcePageExcerpt {
  quote: string;
  quote_start_offset: number;
  quote_end_offset: number;
  location_label: string;
}

/** A bounded original-page package. It is still context-only until an
 * operator selects it for the existing Evidence Intake workflow. */
export interface ResearchSourceRetrievalItem {
  retrieval_id: string;
  triage_id: string;
  origin_lead_id: string;
  topic_id: string | null;
  branch_id: string | null;
  candidate_node_id: string | null;
  source_class: ResearchLeadSourceClass;
  disposition: ResearchLeadDisposition;
  title: string;
  url: string;
  fetched_at: string;
  status: 'retrieved' | 'skipped' | 'failed';
  http_status: number | null;
  content_type: string | null;
  page_title: string | null;
  excerpts: SourcePageExcerpt[];
  content_hash: string | null;
  error: string | null;
  evidence_eligibility: 'context_only';
  next_action: 'prepare_intake' | 'hold';
}

export interface ResearchSourceRetrievalReport {
  artifact_type: 'research_source_retrieval_report';
  schema_version: '1.0.0';
  producer_version: string;
  retrieval_run_id: string;
  generated_at: string;
  triage_id: string | null;
  requested_count: number;
  retrieved_count: number;
  skipped_count: number;
  failed_count: number;
  items: ResearchSourceRetrievalItem[];
  guardrail_check: {
    only_governed_source_classes_requested: true;
    bounded_excerpts_only: true;
    original_url_preserved: true;
    no_auto_evidence_import: true;
    evidence_table_required_for_stage: true;
    parent_branch_separation: true;
    no_trading_advice: true;
  };
}
