export type ResearchLeadOrigin = 'web' | 'direct';
export type ResearchLeadSourceClass = 'official' | 'company_primary' | 'academic' | 'reference' | 'community' | 'secondary' | 'unknown';
export type ResearchLeadRelevance = 'explicit' | 'contextual' | 'unverified';
export type ResearchLeadFreshness = 'fresh' | 'recent' | 'archive' | 'undated';
export type ResearchLeadDisposition = 'priority_review' | 'review' | 'reference_only' | 'hold' | 'duplicate';

/** A ranked discovery record. It remains context-only and has no Stage or
 * Evidence Table effect. */
export interface ResearchLeadTriageItem {
  triage_id: string;
  origin: ResearchLeadOrigin;
  origin_lead_id: string;
  duplicate_origin_lead_ids: string[];
  topic_id: string | null;
  branch_id: string | null;
  candidate_node_id: string | null;
  title: string;
  url: string;
  source_name: string;
  source_domain: string;
  snippet: string;
  published_at: string | null;
  retrieved_at: string;
  source_class: ResearchLeadSourceClass;
  relevance: ResearchLeadRelevance;
  freshness: ResearchLeadFreshness;
  priority_score: number;
  priority: 'high' | 'medium' | 'low';
  disposition: ResearchLeadDisposition;
  reasons: string[];
  next_action: 'review_original' | 'retrieve_primary_source' | 'validate_market_name' | 'hold';
  evidence_eligibility: 'context_only' | 'baseline_evidence';
}

export interface ResearchLeadTriageReport {
  artifact_type: 'research_lead_triage_report';
  schema_version: '1.0.0';
  producer_version: string;
  triage_id: string;
  generated_at: string;
  web_research_id: string | null;
  direct_research_id: string | null;
  input_lead_count: number;
  triaged_lead_count: number;
  summary: {
    priority_review_count: number;
    review_count: number;
    reference_only_count: number;
    hold_count: number;
    duplicate_count: number;
    official_or_academic_count: number;
  };
  items: ResearchLeadTriageItem[];
  guardrail_check: {
    input_results_remain_context_only: true;
    no_auto_evidence_import: true;
    evidence_table_required_for_stage: true;
    parent_branch_separation: true;
    no_trading_advice: true;
  };
}
