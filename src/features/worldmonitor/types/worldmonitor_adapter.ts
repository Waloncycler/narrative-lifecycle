import type {
  EvidenceImportConfidence,
  EvidenceImportLayer,
  EvidenceImportPolarity,
  EvidenceImportSourceType,
  EvidenceImportStageEffect,
} from '@/features/evidence/types/evidence_import';
import type { EvidenceCandidate, EvidenceIntakeSession, ProvenanceRecord, RawDocument } from '@/features/intake/types/intake';

export type WorldMonitorDomain =
  | 'geopolitics'
  | 'financial'
  | 'energy'
  | 'infrastructure'
  | 'health'
  | 'climate'
  | 'technology'
  | 'research'
  | 'osint';

export type WorldMonitorEvidenceEligibility = 'candidate' | 'context_only' | 'unsupported';
export type WorldMonitorAccessState =
  | 'sandbox_available'
  | 'production_ready'
  | 'requires_key'
  | 'requires_parameters'
  | 'manual_request'
  | 'unsupported';
export type WorldMonitorSyncMode = 'sandbox' | 'live';
export type WorldMonitorAuthRequirement = 'public_no_key' | 'worldmonitor_key' | 'source_parameters';
export type WorldMonitorSourceClass = 'direct_public' | 'worldmonitor_hosted';
export type WorldMonitorGovernanceState = 'research_ready' | 'review_required' | 'restricted' | 'blocked';
export type WorldMonitorTermsStatus = 'public_documented' | 'provider_terms_apply' | 'entitlement_required' | 'unknown';
export type WorldMonitorSensitivity = 'public' | 'potential_pii' | 'operational' | 'restricted';
export type WorldMonitorRawPayloadPolicy = 'transient_hash_only' | 'sanitized_cache' | 'prohibited';
export type WorldMonitorObservationWindow = 'sliding_time' | 'active_set' | 'top_n' | 'time_series' | 'unknown';

export interface WorldMonitorSourceGovernance {
  source_class: WorldMonitorSourceClass;
  governance_state: WorldMonitorGovernanceState;
  terms_status: WorldMonitorTermsStatus;
  license_id: string;
  terms_url: string | null;
  attribution_required: boolean;
  redistribution_allowed: boolean;
  sensitivity: WorldMonitorSensitivity;
  raw_payload_policy: WorldMonitorRawPayloadPolicy;
  retention_days: number;
  freshness_window_hours: number | null;
  automated_polling_allowed: boolean;
  observation_window: WorldMonitorObservationWindow;
  absence_assertion_allowed: boolean;
}

export interface WorldMonitorSignal {
  signal_id: string;
  upstream_record_id?: string | null;
  source_id: string;
  operation_id?: string;
  domain: WorldMonitorDomain;
  timestamp: string;
  event_date: string;
  available_at?: string;
  event_title: string;
  event_summary: string;
  event_type: string;
  source_name: string;
  source_url?: string | null;
  location?: {
    lat?: number;
    lng?: number;
    country?: string;
    region_name?: string;
  };
  metrics?: Record<string, number>;
  raw_payload?: Record<string, unknown>;
  raw_payload_hash?: string;
  confidence_score: number;
  data_mode?: WorldMonitorSyncMode;
  upstream_provenance?: string[];
  source_quote?: string;
  normalizer_id?: string;
  normalizer_version?: string;
  research_analysis?: import('@/features/research/domain/news_evidence_funnel').NewsResearchAnalysis;
}

export interface WorldMonitorNormalizedFact {
  upstream_record_id: string | null;
  event_at: string;
  available_at: string;
  title: string;
  summary: string;
  event_type: string;
  source_url: string;
  source_quote: string;
  location?: {
    lat?: number;
    lng?: number;
    country?: string;
    region_name?: string;
  };
  metrics?: Record<string, number>;
  raw_record: Record<string, unknown>;
  normalizer_id: string;
  normalizer_version: '1.0.0';
}

export interface WorldMonitorSourceConfig {
  source_id: string;
  source_name: string;
  domain: WorldMonitorDomain;
  source_type: EvidenceImportSourceType;
  primary_layer: EvidenceImportLayer;
  secondary_layers: EvidenceImportLayer[];
  default_evidence_strength: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
  default_event_type: string;
  default_stage_effect: EvidenceImportStageEffect;
  default_polarity: EvidenceImportPolarity;
  default_confidence: EvidenceImportConfidence;
}

export interface WorldMonitorOperationDescriptor {
  operation_id: string;
  service: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  required_parameters: string[];
  optional_parameters: string[];
  domain: WorldMonitorDomain;
  evidence_eligibility: WorldMonitorEvidenceEligibility;
  auth_requirement: WorldMonitorAuthRequirement;
  access_state: WorldMonitorAccessState;
  sandbox_fixture: string | null;
  production_url: string;
  post_body?: string;
  content_type?: string;
  request_headers?: Record<string, string>;
  normalizer_id: string;
  normalizer_version: '1.0.0';
  governance: WorldMonitorSourceGovernance;
}

export interface WorldMonitorSourceInventory {
  artifact_type: 'worldmonitor_source_inventory';
  schema_version: '1.0.0';
  producer_version: string;
  generated_at: string;
  reference_root: string;
  production_configured: boolean;
  service_count: number;
  operation_count: number;
  pollable_operation_count: number;
  candidate_operation_count: number;
  context_only_operation_count: number;
  unsupported_operation_count: number;
  sandbox_operation_count: number;
  operations: WorldMonitorOperationDescriptor[];
  guardrail_check: {
    catalog_is_not_connectivity_claim: true;
    sandbox_is_not_live_evidence: true;
    human_review_required: boolean;
    no_trading_advice: true;
  };
}

export interface WorldMonitorFetchRecord {
  operation_id: string;
  fetched_at: string;
  mode: WorldMonitorSyncMode;
  status: 'ok' | 'skipped' | 'failed';
  http_status: number | null;
  access_state: WorldMonitorAccessState;
  evidence_eligibility: WorldMonitorEvidenceEligibility;
  source_url: string;
  payload_hash: string | null;
  record_count: number;
  candidate_count: number;
  selected_candidate_count: number;
  degraded: boolean;
  stale: boolean;
  message: string;
  governance_state: WorldMonitorGovernanceState;
  raw_payload_retained: false;
}

export interface WorldMonitorSyncReport {
  artifact_type: 'worldmonitor_sync_report';
  schema_version: '1.0.0';
  producer_version: string;
  sync_id: string;
  generated_at: string;
  mode: WorldMonitorSyncMode;
  requested_operation_count: number;
  completed_operation_count: number;
  failed_operation_count: number;
  skipped_operation_count: number;
  payload_record_count: number;
  candidate_count: number;
  new_fact_count: number;
  updated_fact_count: number;
  material_update_count: number;
  suppressed_update_count: number;
  unchanged_fact_count: number;
  not_observed_fact_count: number;
  fact_state_id: string | null;
  intake_session_id: string | null;
  records: WorldMonitorFetchRecord[];
  guardrail_check: {
    sandbox_not_importable: boolean;
    context_only_not_scored: boolean;
    human_review_required: boolean;
    topic_resolver_required: true;
    duplicate_detection_required: true;
    parent_branch_separation: true;
    no_trading_advice: true;
  };
}
export type WorldMonitorFactChangeType = 'new' | 'updated' | 'unchanged' | 'not_observed';

export interface WorldMonitorMetricDelta {
  metric: string;
  previous: number | null;
  current: number | null;
  absolute_delta: number | null;
  relative_delta: number | null;
}

export interface WorldMonitorFactStateEntry {
  fact_key: string;
  operation_id: string;
  upstream_record_id: string | null;
  title: string;
  event_at: string;
  available_at: string;
  source_url: string;
  normalizer_id: string;
  normalizer_version: string;
  content_fingerprint: string;
  metrics: Record<string, number>;
  first_seen_at: string;
  last_seen_at: string;
}

export interface WorldMonitorFactChange {
  fact_key: string;
  operation_id: string;
  change_type: WorldMonitorFactChangeType;
  previous_fingerprint: string | null;
  current_fingerprint: string | null;
  title: string;
  event_at: string;
  source_url: string;
  actionable: boolean;
  materiality_policy: string;
  materiality_reason: string;
  metric_deltas: WorldMonitorMetricDelta[];
}

export interface WorldMonitorFactState {
  artifact_type: 'worldmonitor_fact_state';
  schema_version: '1.0.0';
  producer_version: string;
  state_id: string;
  sync_id: string;
  generated_at: string;
  previous_state_id: string | null;
  observed_operation_ids: string[];
  fact_count: number;
  new_fact_count: number;
  updated_fact_count: number;
  material_update_count: number;
  suppressed_update_count: number;
  unchanged_fact_count: number;
  not_observed_fact_count: number;
  facts: WorldMonitorFactStateEntry[];
  changes: WorldMonitorFactChange[];
  guardrail_check: {
    unchanged_not_queued: true;
    not_observed_not_evidence: true;
    failed_source_not_treated_as_removal: true;
    human_review_required: boolean;
    no_trading_advice: true;
  };
}

export interface WorldMonitorPayload {
  descriptor: WorldMonitorOperationDescriptor;
  fetched_at: string;
  source_url: string;
  mode: WorldMonitorSyncMode;
  body: unknown;
  payload_hash: string;
  degraded: boolean;
  stale: boolean;
}

export interface ConvertedWorldMonitorCandidate {
  signal: WorldMonitorSignal;
  raw_document: RawDocument;
  provenance_record: ProvenanceRecord;
  candidate: EvidenceCandidate;
}

export interface WorldMonitorIntakeBatchResult {
  batch_id: string;
  processed_at: string;
  total_signals: number;
  accepted_candidates: ConvertedWorldMonitorCandidate[];
  skipped_signals_count: number;
  errors: Array<{ signal_id: string; message: string }>;
}

export interface WorldMonitorSyncResult {
  inventory: WorldMonitorSourceInventory;
  report: WorldMonitorSyncReport;
  factState: WorldMonitorFactState | null;
  session: EvidenceIntakeSession | null;
}
