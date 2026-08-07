import type { EvidenceImportDraft } from './evidence_import';

export type RawDocumentKind = 'txt' | 'markdown' | 'docx' | 'html' | 'pdf' | 'pasted_text';
export type ReviewDecisionKind = 'accept' | 'modify' | 'reject' | 'split';

export interface RawDocument {
  raw_document_id: string;
  source_name: string;
  source_kind: RawDocumentKind;
  ingested_at: string;
  text: string;
  character_count: number;
}

export interface DocumentChunk {
  chunk_id: string;
  raw_document_id: string;
  index: number;
  text: string;
  start_offset: number;
  end_offset: number;
}

export interface ProvenanceRecord {
  provenance_id: string;
  raw_document_id: string;
  chunk_id: string;
  quote: string;
  quote_start_offset: number;
  quote_end_offset: number;
  location_label: string;
  extraction_reason: string;
}

export interface EvidenceCandidate {
  candidate_id: string;
  raw_document_id: string;
  chunk_id: string;
  provenance_id: string;
  original_quote: string;
  suggested_evidence: EvidenceImportDraft;
  suggested_reason: string;
  uncertainty_notes: string[];
  field_explanations: Record<string, string>;
  e_strength_rationale: string;
  /** How far a deterministic source parser verified this candidate. */
  publication_eligibility?: 'manual_review' | 'rule_verified';
  duplicate_of_evidence_id?: string | null;
  guardrail_check: {
    no_trading_advice: boolean;
    provenance_present: boolean;
    human_review_required: boolean;
  };
}

export interface AiCandidateSuggestion {
  ai_candidate_id: string;
  candidate_id: string;
  original_quote: string;
  suggested_evidence: EvidenceImportDraft;
  suggested_reason: string;
  uncertainty_notes: string[];
  alternative_mappings: Array<{
    topic_id: string;
    branch_id?: string | null;
    reason: string;
  }>;
  provider?: string;
  model_version?: string;
  prompt_version?: string;
  validation_status?: 'passed' | 'failed' | 'fallback';
  validation_errors?: string[];
  fallback_used?: boolean;
  shadow_mode: true;
}

export interface CandidateGenerationComparison {
  candidate_id: string;
  rule_topic_id: string;
  ai_topic_id: string | null;
  rule_branch_id?: string | null;
  ai_branch_id?: string | null;
  rule_scope?: string | null;
  ai_scope?: string | null;
  rule_strength?: string | null;
  ai_strength?: string | null;
  rule_layers?: string[];
  ai_layers?: string[];
  rule_limitation?: string | null;
  ai_limitation?: string | null;
  differs: boolean;
  difference_summary: string;
  human_decision_required: boolean;
}

export interface AiShadowAuditRecord {
  audit_id: string;
  generated_at: string;
  session_id: string;
  provider: string;
  model_version: string;
  prompt_version: string;
  status: 'passed' | 'fallback' | 'failed';
  candidate_count: number;
  fallback_count: number;
  invalid_count: number;
  request_fingerprints: string[];
  response_fingerprints: string[];
  errors: string[];
  secret_redaction: 'api_key_not_persisted';
}

export interface AiShadowValidationReport {
  report_id: string;
  generated_at: string;
  baseline_version: 'v0.5.6-rule-baseline';
  document_count: number;
  rule_only_candidate_count: number;
  ai_candidate_count: number;
  fallback_count: number;
  invalid_output_count: number;
  precision: number | 'pending_human_review';
  recall: number | 'pending_human_review';
  unsupported_claim_rate: number;
  citation_accuracy: number;
  topic_branch_accuracy: number | 'pending_human_review';
  e3_e4_overstatement_count: number;
  average_review_time_seconds: number | 'insufficient_data';
  field_modification_rate: number | 'pending_human_review';
  final_user_selection: Record<string, number>;
  guardrail_check: {
    schema_validated: boolean;
    citation_checked: boolean;
    parent_branch_checked: boolean;
    e_strength_checked: boolean;
    no_trading_advice: boolean;
    fallback_to_rule_based: boolean;
    secrets_not_persisted: boolean;
  };
}

export interface ReviewDecision {
  candidate_id: string;
  decision: ReviewDecisionKind;
  reviewer: string;
  reviewed_at: string;
  review_started_at?: string;
  review_duration_seconds?: number;
  modified_evidence?: EvidenceImportDraft;
  split_evidence?: EvidenceImportDraft[];
  rejection_reason?: string;
  reviewer_note?: string;
}

export interface EvidenceIntakeSession {
  session_id: string;
  generated_at: string;
  raw_document: RawDocument;
  chunks: DocumentChunk[];
  provenance_records: ProvenanceRecord[];
  candidates: EvidenceCandidate[];
  ai_shadow_candidates?: AiCandidateSuggestion[];
  candidate_comparisons?: CandidateGenerationComparison[];
  review_template: ReviewDecision[];
}

export interface EvidenceIntakeApplyResult {
  session_id: string;
  topic_audit_id: string;
  generated_at: string;
  accepted_count: number;
  modified_count: number;
  split_count: number;
  rejected_count: number;
  duplicate_count: number;
  accepted_evidence_ids: string[];
  evidence_draft_path: string | null;
  imported: boolean;
  import_status: string;
  import_id: string | null;
  weekly_run_id: string | null;
  stage_change_summary: unknown | null;
  pipeline_retry_count?: number;
  pipeline_error?: string | null;
  guardrail_check: {
    human_review_required: boolean;
    no_trading_advice: boolean;
    duplicate_detection_applied: boolean;
    parent_branch_guardrail_applied: boolean;
  };
}

export interface CandidateReviewFeedback {
  candidate_id: string;
  final_decision: ReviewDecisionKind;
  modified_fields: string[];
  rejection_reason?: string | null;
  review_duration_seconds: number | null;
  duplicate_hit: boolean;
  parent_branch_error: boolean;
  field_accuracy: number;
}

export interface IntakeEvaluationReport {
  evaluation_id: string;
  generated_at: string;
  session_id: string;
  candidate_count: number;
  acceptance_rate: number;
  modification_rate: number;
  rejection_rate: number;
  split_rate: number;
  field_accuracy: number;
  average_review_time_seconds: number | 'insufficient_data';
  duplicate_prevention_count: number;
  parent_branch_error_rate: number;
  ai_shadow_difference_count: number;
  feedback: CandidateReviewFeedback[];
  unresolved_candidate_ids: string[];
  guardrail_check: {
    human_review_required: boolean;
    no_trading_advice: boolean;
    ai_shadow_only: boolean;
    no_auto_topic_activation: boolean;
  };
}
