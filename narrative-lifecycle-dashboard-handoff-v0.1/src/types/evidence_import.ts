import type { EvidenceNode } from '../domain/evidence';

export type EvidenceImportScope = 'parent' | 'branch';
export type EvidenceImportSourceType = 'official' | 'filing' | 'news' | 'research' | 'academic' | 'company' | 'other';
export type EvidenceImportLayer = 'name' | 'capital' | 'pricing' | 'reality' | 'momentum' | 'friction' | 'data_confidence';
export type EvidenceImportStageEffect = 'upgrade' | 'maintain' | 'downgrade' | 'watch_upgrade' | 'split_branch' | 'no_change';
export type EvidenceImportPolarity = 'positive' | 'negative' | 'mixed' | 'neutral';
export type EvidenceImportConfidence = 'low' | 'medium' | 'high';

export interface EvidenceImportDraft {
  evidence_id: string;
  topic_id: string;
  branch_id?: string | null;
  scope: EvidenceImportScope;
  event_date: string;
  available_at: string;
  event_title: string;
  event_summary: string;
  event_type: string;
  source_name: string;
  source_url?: string | null;
  source_type: EvidenceImportSourceType;
  evidence_strength: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
  affected_layer: EvidenceImportLayer[];
  stage_effect: EvidenceImportStageEffect;
  polarity: EvidenceImportPolarity;
  interpretation: string;
  limitation: string;
  confidence: EvidenceImportConfidence;
}

export interface NormalizedEvidenceImport {
  import_id: string;
  imported_at: string;
  source_file: string;
  evidence_hash: string;
  draft: EvidenceImportDraft;
  evidence: EvidenceNode;
}

export interface EvidenceValidationIssue {
  evidence_id: string;
  field?: string;
  message: string;
}

export interface EvidenceImportGuardrailCheck {
  no_trading_advice: boolean;
  parent_branch_scope_valid: boolean;
  evidence_strength_valid: boolean;
  affected_layer_valid: boolean;
  source_metadata_present: boolean;
}

export interface EvidenceValidationReport {
  validation_id: string;
  generated_at: string;
  source_file: string;
  status: 'passed' | 'failed';
  accepted_count: number;
  rejected_count: number;
  errors: EvidenceValidationIssue[];
  warnings: EvidenceValidationIssue[];
  accepted_evidence_ids: string[];
  rejected_evidence_ids: string[];
  guardrail_check: EvidenceImportGuardrailCheck;
}

export interface EvidenceImportReport extends EvidenceValidationReport {
  import_id: string;
  imported_at: string;
  accepted_copy_path?: string;
  rejected_copy_path?: string;
  fixture_target_path?: string;
  audit_log_path?: string;
}

export interface EvidenceImportAuditRecord {
  import_id: string;
  imported_at: string;
  source_file: string;
  accepted_count: number;
  rejected_count: number;
  evidence_ids: string[];
  validation_errors: EvidenceValidationIssue[];
  operator_action: 'evidence_import';
  rule_version: string;
}
