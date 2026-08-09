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
  | 'minimax'
  | 'searxng'
  | 'mcp_bridge';
export type WebResearchStatus = 'completed' | 'unconfigured' | 'degraded';

export interface WebSearchConfig {
  provider: WebSearchProvider;
  endpoint: string | null;
  api_key: string | null;
  timeout_ms: number;
  max_results_per_query: number;
  /** DuckDuckGo HTML: region code (e.g. 'us-en', 'cn-zh', 'de-de'). */
  region?: string | null;
  /** DuckDuckGo HTML safe-search level; defaults to 'moderate'. */
  safe_search?: 'strict' | 'moderate' | 'off';
  /** SearXNG comma-separated categories (e.g. 'general,news'); defaults 'general'. */
  searxng_categories?: string | null;
  /** SearXNG result language code (e.g. 'en', 'zh-Hans'). */
  searxng_language?: string | null;
  /** MiniMax search region: 'global' (minimax.io) or 'cn' (minimaxi.com). */
  minimax_region?: 'global' | 'cn';
}

export interface WebResearchQuery {
  query_id: string;
  query: string;
  topic_id: string | null;
  branch_id?: string | null;
  candidate_node_id?: string | null;
  campaign_task_id?: string | null;
  source_ids?: string[];
  /** Domains used as a search hint (for example, an official-source pass). */
  source_domains?: string[];
  /** Domains that must match a returned lead. Wide Topic/Branch discovery
   * intentionally leaves this empty; company IR queries set it. */
  strict_source_domains?: string[];
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

/** Per-provider execution telemetry. It makes free discovery observable
 * without treating search output as formal Evidence. */
export interface WebResearchProviderRun {
  provider: WebSearchProvider;
  query_count: number;
  successful_query_count: number;
  zero_result_query_count: number;
  raw_result_count: number;
  normalized_lead_count: number;
  error_count: number;
}

/** Yield after normalization, grouped by reported upstream source name. */
export interface WebResearchSourceYield {
  source_name: string;
  lead_count: number;
}

export interface WebResearchReport {
  artifact_type: 'web_research_report';
  schema_version: '1.0.0';
  producer_version: string;
  research_id: string;
  generated_at: string;
  status: WebResearchStatus;
  /** Primary engine driving the report (first runnable config). */
  provider: WebSearchProvider;
  /** Every search engine that actually ran for this pass, in parallel. */
  providers: WebSearchProvider[];
  queries: WebResearchQuery[];
  lead_count: number;
  leads: WebResearchLead[];
  errors: string[];
  /** Optional to preserve reads of pre-observability report artifacts. */
  provider_runs?: WebResearchProviderRun[];
  source_yield?: WebResearchSourceYield[];
  guardrail_check: {
    search_snippets_not_formal_evidence: true;
    evidence_table_required_for_stage: true;
    parent_branch_separation: true;
    no_auto_import: true;
    no_trading_advice: true;
  };
}
