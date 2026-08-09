import type { EvidenceStrength } from '@/features/evidence/domain/evidence';

export type BaselineAdmissionStatus = 'already_admitted' | 'ready_for_review' | 'insufficient_evidence' | 'blocked';

export interface BaselineEvidenceCandidate {
  evidence_id: string;
  event_title: string;
  event_date: string;
  source_url: string;
  source_host: string;
  evidence_strength: EvidenceStrength;
  confidence: number;
}

export interface BaselineEvidenceReconciliationItem {
  topic_id: string;
  topic_name: string;
  status: BaselineAdmissionStatus;
  eligible_parent_evidence: BaselineEvidenceCandidate[];
  excluded_evidence_ids: string[];
  independent_source_count: number;
  reasons: string[];
}

export interface BaselineEvidenceReconciliationReport {
  artifact_type: 'baseline_evidence_reconciliation_report';
  schema_version: '1.0.0';
  producer_version: string;
  report_id: string;
  generated_at: string;
  summary: {
    active_topic_count: number;
    already_admitted_count: number;
    ready_for_review_count: number;
    insufficient_evidence_count: number;
    blocked_count: number;
    eligible_parent_evidence_count: number;
  };
  items: BaselineEvidenceReconciliationItem[];
  guardrail_check: {
    evidence_table_required: true;
    parent_branch_separation: true;
    no_automatic_admission: true;
    no_trading_advice: true;
  };
}
