/** Provider-neutral web discovery contract. Search is for finding material,
 *  never for supplying formal Evidence directly. */
export type WebSearchProvider =
  | 'disabled'
  | 'free'
  | 'gdelt'
  | 'wikipedia'
  | 'hn'
  | 'duckduckgo'
  | 'reddit'
  | 'arxiv'
  | 'openalex'
  | 'archive'
  | 'bing'
  | 'brave'
  | 'tavily'
  | 'mcp_bridge';
export type WebResearchStatus = 'completed' | 'unconfigured' | 'degraded';

export interface WebSearchConfig {
  provider: WebSearchProvider;
  endpoint: string | null;
  api_key: string | null;
  timeout_ms: number;
  max_results_per_query: number;
}

export interface WebResearchQuery {
  query_id: string;
  query: string;
  topic_id: string | null;
  branch_id?: string | null;
  candidate_node_id?: string | null;
  campaign_task_id?: string | null;
  source_ids?: string[];
  source_domains?: string[];
  purpose: 'evidence_discovery' | 'name_validation';
}

export interface WebResearchLead {
  lead_id: string;
  query_id: string;
  topic_id: string | null;
  /** Preserves branch/seed identity from campaign planning. It is never an
   *  instruction to promote a parent topic. */
  branch_id?: string | null;
  candidate_node_id?: string | null;
  title: string;
  url: string;
  source_name: string;
  source_domain: string;
  snippet: string;
  published_at: string | null;
  retrieved_at: string;
  rank: number;
  /** Search results remain background leads until their source page is
   * independently reviewed and admitted through the Evidence pipeline. */
  evidence_eligibility: 'context_only';
  next_action: 'review_source' | 'validate_market_name';
}

export interface WebResearchReport {
  artifact_type: 'web_research_report';
  schema_version: '1.0.0';
  producer_version: string;
  research_id: string;
  generated_at: string;
  status: WebResearchStatus;
  provider: WebSearchProvider;
  queries: WebResearchQuery[];
  lead_count: number;
  leads: WebResearchLead[];
  errors: string[];
  guardrail_check: {
    search_snippets_not_formal_evidence: true;
    evidence_table_required_for_stage: true;
    parent_branch_separation: true;
    no_auto_import: true;
    no_trading_advice: true;
  };
}
