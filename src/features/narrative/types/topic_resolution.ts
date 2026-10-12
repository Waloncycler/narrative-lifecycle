export type TopicResolutionStatus =
  | 'existing_topic'
  | 'alias_of'
  | 'new_branch'
  | 'reactivation'
  | 'new_provisional_topic'
  | 'unresolved';

/**
 * A human-readable market name must be traceable to a source that actually
 * uses it. The id remains stable for machines; this record controls what a
 * researcher sees.
 */
export interface MarketNameSource {
  source_name: string;
  source_url: string;
  available_at: string;
  source_quote: string;
}

export type MarketNamingStatus = 'verified' | 'provisional' | 'unresolved';

export interface CanonicalTopicRecord {
  topic_id: string;
  topic_name: string;
  current_stage: string;
  status: 'active' | 'archived' | 'provisional';
  /** Widely used Chinese market name. Never generated from an id. */
  market_name_zh?: string;
  /** English name is retained for cross-language retrieval and aliases. */
  market_name_en?: string;
  naming_status?: MarketNamingStatus;
  naming_sources?: MarketNameSource[];
}

export interface AliasRecord {
  alias: string;
  topic_id: string;
  reason: string;
}

export interface BranchRecord {
  branch_id: string;
  topic_id: string;
  branch_name: string;
  status: 'active' | 'watch' | 'archived';
  market_name_zh?: string;
  market_name_en?: string;
  naming_status?: MarketNamingStatus;
  naming_sources?: MarketNameSource[];
}

export interface ProvisionalTopicRecord {
  provisional_topic_id: string;
  proposed_name: string;
  source_candidate_id: string;
  created_at: string;
  status: 'provisional' | 'promoted' | 'rejected';
  reason: string;
}

export interface TopicRegistry {
  canonical_topics: CanonicalTopicRecord[];
  aliases: AliasRecord[];
  branches: BranchRecord[];
  provisional_topics: ProvisionalTopicRecord[];
  memory_topic_ids: string[];
}

export interface TopicResolution {
  candidate_id: string;
  status: TopicResolutionStatus;
  resolved_topic_id: string | null;
  resolved_branch_id: string | null;
  provisional_topic_id: string | null;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  audit_required: boolean;
  alternatives: Array<{
    status: TopicResolutionStatus;
    topic_id?: string | null;
    branch_id?: string | null;
    reason: string;
  }>;
}

export interface TopicResolutionAudit {
  audit_id: string;
  generated_at: string;
  session_id: string | null;
  resolutions: TopicResolution[];
  unresolved_queue: TopicResolution[];
  registry_validation: TopicRegistryValidationReport;
  guardrail_check: {
    no_forced_mapping: boolean;
    provisional_topics_do_not_inherit_stage: boolean;
    topic_changes_require_audit: boolean;
    branch_changes_do_not_upgrade_parent: boolean;
  };
}

export interface TopicRegistryValidationReport {
  validation_id: string;
  generated_at: string;
  status: 'passed' | 'failed';
  topic_count: number;
  alias_count: number;
  branch_count: number;
  provisional_topic_count: number;
  unresolved_count: number;
  errors: string[];
  warnings: string[];
}
