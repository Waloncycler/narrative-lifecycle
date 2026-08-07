import type { EvidenceImportDraft } from './evidence_import';
import type { EvidenceChainRelation } from './evidence_chain';
import type { IndustryPackStatus } from './industry';

export type AgentCandidateValidationStatus = 'passed' | 'failed' | 'fallback';

export interface AgentCandidateAlternativeMapping {
  topic_id: string | null;
  branch_id?: string | null;
  scope?: 'parent' | 'branch' | null;
  reason: string;
}

export interface AgentEvidenceCandidate {
  agent_candidate_id: string;
  source_candidate_id: string;
  raw_document_id: string;
  chunk_id: string;
  provenance_id: string;
  original_quote: string;
  quote_start_offset: number;
  quote_end_offset: number;
  supported_fact: string;
  inferred_interpretation: string;
  limitation: string;
  suggested_evidence: EvidenceImportDraft;
  suggested_reason: string;
  uncertainty_notes: string[];
  alternative_mappings: AgentCandidateAlternativeMapping[];
  /** Candidate-only chain suggestions. Existing evidence ids are verified again
   * by the domain layer before any audit entry is written. */
  chain_relation?: EvidenceChainRelation;
  target_evidence_ids?: string[];
  target_stage_gate?: string | null;
  industry_id?: string | null;
  industry_status?: IndustryPackStatus;
  provider: string;
  model_version: string;
  prompt_version: string;
  validation_status: AgentCandidateValidationStatus;
  validation_errors: string[];
  fallback_used: boolean;
  human_review_required: boolean;
}

export interface AgentCandidateVerification {
  agent_candidate_id: string;
  status: 'passed' | 'failed' | 'fallback';
  errors: string[];
  checks: {
    citation_exists: boolean;
    fact_interpretation_separated: boolean;
    parent_branch_valid: boolean;
    evidence_strength_checked: boolean;
    no_trading_advice: boolean;
    human_review_required: boolean;
  };
}

export interface IntakeAgentVerificationReport {
  report_id: string;
  generated_at: string;
  session_id: string;
  candidate_count: number;
  passed_count: number;
  failed_count: number;
  fallback_count: number;
  candidates: AgentCandidateVerification[];
  guardrail_check: {
    schema_validated: boolean;
    citation_checked: boolean;
    parent_branch_checked: boolean;
    stage_not_reclassified: true;
    scoring_not_run: true;
    no_auto_import: boolean;
    no_trading_advice: boolean;
    secrets_not_persisted: true;
  };
}

export interface IntakeAgentAudit {
  audit_id: string;
  generated_at: string;
  session_id: string;
  provider: string;
  model_version: string;
  prompt_version: string;
  status: 'passed' | 'fallback' | 'failed';
  request_fingerprint: string;
  response_fingerprint: string | null;
  error: string | null;
  secret_redaction: 'api_key_not_persisted';
}

export interface IntakeAgentReviewBundle {
  agent_version: 'v0.7.0';
  generated_at: string;
  session_id: string;
  candidates: AgentEvidenceCandidate[];
  verification: IntakeAgentVerificationReport;
  audit: IntakeAgentAudit;
  import_permission: 'human_review_then_existing_import_only' | 'auto_import';
}
