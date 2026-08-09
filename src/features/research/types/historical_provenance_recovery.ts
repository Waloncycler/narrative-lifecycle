import type { EvidenceScope } from '@/features/evidence/domain/evidence';
import type { ResearchSourceRetrievalItem } from '@/features/research/types/research_source_retrieval';

export interface HistoricalProvenanceRecoveryTarget {
  legacy_evidence_id: string;
  topic_id: string;
  branch_id: string | null;
  scope: Extract<EvidenceScope, 'parent' | 'branch'>;
  event_title: string;
  event_date: string;
  known_source_url: string | null;
  search_queries: string[];
}

export type HistoricalCorroborationStatus = 'auto_intake_ready' | 'citation_ready_but_unverified' | 'insufficient';

export interface HistoricalProvenanceRecoveryItem {
  recovery_id: string;
  target: HistoricalProvenanceRecoveryTarget;
  retrieved_sources: ResearchSourceRetrievalItem[];
  independent_source_hosts: string[];
  corroboration_status: HistoricalCorroborationStatus;
  reason: string;
}

/** A bounded, append-only recovery artifact. Its `auto_intake_ready` status
 * means only that it may enter the existing agent + policy pipeline; it is
 * not an Evidence admission or a lifecycle decision. */
export interface HistoricalProvenanceRecoveryReport {
  artifact_type: 'historical_provenance_recovery_report';
  schema_version: '1.0.0';
  producer_version: string;
  recovery_run_id: string;
  generated_at: string;
  search_provider: string;
  requested_target_count: number;
  recovered_target_count: number;
  auto_intake_ready_count: number;
  citation_ready_unverified_count: number;
  insufficient_count: number;
  items: HistoricalProvenanceRecoveryItem[];
  guardrail_check: {
    search_results_not_evidence: true;
    original_page_quotes_required: true;
    two_independent_sources_required_for_auto_intake: true;
    parent_branch_separation: true;
    same_scope_corroboration_only: true;
    existing_stage_unchanged: true;
    no_direct_evidence_import: true;
    no_trading_advice: true;
  };
}
