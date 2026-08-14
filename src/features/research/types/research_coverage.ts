export type ResearchAuthorityTier = 'statutory' | 'regulator' | 'intergovernmental' | 'filing' | 'academic' | 'company' | 'news';
export type ResearchSourceAccess = 'direct_api' | 'rss_or_html' | 'search_bridge' | 'manual_review';
export type ResearchCoverageLayer = 'name' | 'capital' | 'pricing' | 'reality' | 'momentum' | 'friction' | 'data_confidence';

/** A governed capability declaration, not a claim that a source is connected. */
export interface AuthoritativeResearchSource {
  source_id: string;
  display_name_zh: string;
  display_name_en: string;
  operator: string;
  authority_tier: ResearchAuthorityTier;
  domains: string[];
  coverage_layers: ResearchCoverageLayer[];
  access_mode: ResearchSourceAccess;
  base_url: string;
  terms_url: string;
  automated_polling_allowed: boolean;
  review_required: boolean;
  evidence_ceiling: 'E1' | 'E2' | 'E3' | 'E4';
  topic_discovery_capable: boolean;
  branch_discovery_capable: boolean;
  languages: string[];
}

export interface AuthoritativeSourceAtlas {
  atlas_version: string;
  sources: AuthoritativeResearchSource[];
}

/** Market-recognizable research seeds are deliberately not formal Topics. */
export interface ResearchUniverseNode {
  node_id: string;
  display_name_zh: string;
  display_name_en: string;
  aliases: string[];
  domain: string;
  priority: number;
  suggested_branch_names: string[];
  target_layers: ResearchCoverageLayer[];
  preferred_source_ids: string[];
}

export interface ResearchUniverse {
  universe_version: string;
  nodes: ResearchUniverseNode[];
}

/** A curated research target, not a recommendation, coverage universe, or
 * assertion that every company document is connected for automated retrieval. */
export interface CompanyResearchTarget {
  company_id: string;
  display_name_zh: string;
  display_name_en: string;
  market: 'china' | 'hong_kong' | 'us' | 'global' | 'private';
  official_source_url: string;
  disclosure_source_ids: string[];
  coverage_node_ids: string[];
  aliases: string[];
  status: 'curated' | 'watch';
}

export interface CompanyResearchRegistry {
  registry_version: string;
  companies: CompanyResearchTarget[];
}

export interface ResearchCampaignCompanyTarget {
  company_id: string;
  display_name_zh: string;
  display_name_en: string;
  market: CompanyResearchTarget['market'];
  official_source_url: string;
  disclosure_source_ids: string[];
}

export type ResearchCampaignNodeKind = 'formal_topic' | 'provisional_topic' | 'universe_seed' | 'branch';

export interface ResearchCampaignTask {
  task_id: string;
  node_kind: ResearchCampaignNodeKind;
  topic_id: string | null;
  branch_id: string | null;
  candidate_node_id: string | null;
  display_name_zh: string;
  display_name_en: string | null;
  domain: string;
  priority: number;
  target_layers: ResearchCoverageLayer[];
  query: string;
  source_ids: string[];
  source_domains: string[];
  /** Curated companies relevant to this task. They are source-verification
   * targets only and do not turn company material into parent Evidence. */
  company_targets?: ResearchCampaignCompanyTarget[];
  direct_operation_ids: string[];
  rationale: string;
  formal_status: 'formal' | 'provisional' | 'research_seed' | 'watch_branch';
  evidence_eligibility?: 'context_only' | 'baseline_evidence';
  deep_probe_target?: import('@/features/research/domain/research_strategy_mapper').DeepResearchProbeTarget;
}

export interface ResearchCampaign {
  artifact_type: 'research_campaign';
  schema_version: '1.0.0';
  producer_version: string;
  campaign_id: string;
  generated_at: string;
  source_atlas_version: string;
  universe_version: string;
  tasks: ResearchCampaignTask[];
  summary: {
    formal_topic_count: number;
    provisional_topic_count: number;
    universe_seed_count: number;
    branch_count: number;
    source_target_count: number;
    task_count: number;
    skipped_unresolved_branch_count: number;
  };
  guardrail_check: {
    research_seeds_are_not_formal_topics: true;
    source_capability_is_not_connectivity_claim: true;
    search_results_remain_context_only: true;
    parent_branch_separation: true;
    evidence_table_required_for_stage: true;
    no_auto_import: true;
    no_trading_advice: true;
  };
}
