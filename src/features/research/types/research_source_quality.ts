import type { ResearchLeadSourceClass } from '@/features/research/types/research_lead_triage';
import type { ResearchSourceExtractorId, ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';

/**
 * Quality metrics for a bounded retrieval run. Claim support and Topic/Branch
 * correctness remain pending until a researcher records a review decision.
 */
export interface ResearchSourceQualityReport {
  artifact_type: 'research_source_quality_report';
  schema_version: '1.0.0';
  producer_version: string;
  retrieval_run_id: string;
  generated_at: string;
  requested_count: number;
  retrieved_count: number;
  citation_ready_count: number;
  citation_insufficient_count: number;
  citation_ready_rate: number | 'insufficient_data';
  quote_integrity_rate: number | 'insufficient_data';
  average_source_text_chars: number | 'insufficient_data';
  extractor_counts: Partial<Record<ResearchSourceExtractorId, number>>;
  source_class_summary: Partial<Record<ResearchLeadSourceClass, { retrieved_count: number; citation_ready_count: number }>>;
  reviewed_claim_support_rate: number | 'pending_human_review' | 'insufficient_data';
  reviewed_topic_branch_accuracy: number | 'pending_human_review' | 'insufficient_data';
  guardrail_check: {
    metrics_do_not_create_evidence: true;
    claim_support_requires_human_review: true;
    topic_branch_accuracy_requires_human_review: true;
    no_trading_advice: true;
  };
}

export type ResearchSourceQualityInput = Pick<ResearchSourceRetrievalReport, 'producer_version' | 'retrieval_run_id' | 'generated_at' | 'requested_count' | 'retrieved_count' | 'items'>;
