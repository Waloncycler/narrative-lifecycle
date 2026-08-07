export type EvidenceChainRelation = 'supports' | 'contradicts' | 'updates' | 'duplicates' | 'branch_only' | 'fills_gap';
export type EvidenceChainStatus = 'candidate' | 'confirmed' | 'rejected';

export interface EvidenceChainEntry {
  artifact_type: 'evidence_chain_entry';
  schema_version: '1.0.0';
  producer_version: string;
  chain_entry_id: string;
  generated_at: string;
  topic_id: string;
  branch_id: string | null;
  scope: 'parent' | 'branch';
  evidence_id: string;
  source_candidate_id: string | null;
  provenance_id: string | null;
  relation: EvidenceChainRelation;
  prior_evidence_ids: string[];
  affected_stage_gate: string | null;
  why_not_higher_before: string | null;
  source_quote: string;
  status: EvidenceChainStatus;
  idempotency_key: string;
  run_id: string | null;
  operator_decision?: { reviewer: string; decided_at: string; note?: string };
}
