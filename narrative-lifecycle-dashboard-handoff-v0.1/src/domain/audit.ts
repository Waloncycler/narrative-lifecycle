export interface ManualOverride {
  override_id: string;
  target_type: string;
  target_id: string;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  override_reason: string;
  reviewer: string;
  created_at: string;
  rule_version: string;
}

export interface AuditLog {
  audit_id: string;
  target_type: string;
  target_id: string;
  action: string;
  evidence_ids: string[];
  rule_version: string;
  created_at: string;
  details?: unknown;
}

export interface EvaluationResult {
  evaluation_id: string;
  case_id: string;
  metric_name: string;
  result: 'pass' | 'fail' | 'review';
  score?: number;
  expected?: unknown;
  actual?: unknown;
  notes?: string;
  created_at: string;
}

export interface RawSource {
  raw_source_id: string;
  source_name: string;
  source_url?: string;
  source_type?: string;
  raw_text?: string;
  fetched_at?: string;
  content_hash?: string;
}

export interface IncrementalMarker {
  target_id: string;
  event_hash: string;
  evidence_hash: string;
  dirty_flag: boolean;
  last_processed_at?: string;
}
