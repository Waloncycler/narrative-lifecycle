import type { ResearchLeadDisposition, ResearchLeadSourceClass } from '@/features/research/types/research_lead_triage';

export interface SourcePageExcerpt {
  quote: string;
  quote_start_offset: number;
  quote_end_offset: number;
  location_label: string;
}

export type ResearchSourceExtractorId =
  | 'clinicaltrials_api'
  | 'arxiv_abstract'
  | 'sec_edgar_filing'
  | 'federal_register'
  | 'gov_cn_article'
  | 'pubmed_abstract'
  | 'pmc_jats_article'
  | 'structured_json_record'
  | 'company_article'
  | 'jina_reader_markdown'
  | 'mozilla_readability'
  | 'generic_html';

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
  /** Publication date carried from the governed discovery/direct-source lead.
   * It is distinct from fetch time and lets Intake preserve source temporal
   * provenance instead of incorrectly downgrading every retrieved page. */
  source_published_at?: string | null;
  fetched_at: string;
  status: 'retrieved' | 'skipped' | 'failed';
  http_status: number | null;
  content_type: string | null;
  page_title: string | null;
  /** The deterministic extractor used to create the bounded source package. */
  extractor_id?: ResearchSourceExtractorId;
  excerpts: SourcePageExcerpt[];
  /** A source package may be fetched successfully while still lacking a
   * sufficiently specific quote for Evidence review. */
  citation_status?: 'ready' | 'insufficient';
  citation_notes?: string[];
  source_text_chars?: number;
  content_hash: string | null;
  error: string | null;
  evidence_eligibility: 'context_only' | 'baseline_evidence';
  next_action: 'prepare_intake' | 'hold';
  /** Present only for a bounded historic-row recovery. This records the
   * corroboration that permits the primary source package to enter the normal
   * Intake Agent flow; it is not part of the formal Evidence model. */
  historical_recovery?: {
    legacy_evidence_id: string;
    event_date: string;
    scope: 'parent' | 'branch';
    branch_id: string | null;
    corroboration_status: 'verified' | 'unverified';
    corroborating_source_urls: string[];
    independent_source_hosts: string[];
  };
  /** Independent verification for a newly observed secondary-news lead. It
   * authorizes Intake review only; it never raises Evidence strength or Stage. */
  news_corroboration?: {
    news_candidate_id: string;
    seed_source_url: string;
    corroboration_status: 'verified' | 'unverified';
    claim_similarity: number;
    corroborating_source_urls: string[];
    independent_source_hosts: string[];
  };
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
