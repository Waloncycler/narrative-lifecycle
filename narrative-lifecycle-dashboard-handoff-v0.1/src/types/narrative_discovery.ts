export type NarrativeDiscoveryResolution =
  | 'existing_branch'
  | 'new_branch'
  | 'new_provisional_topic'
  | 'reactivation'
  | 'unresolved';

export type NarrativeDiscoveryRegistrationAction = 'watch_branch' | 'provisional_topic' | 'provisional_topic_and_watch_branch' | 'none';

export interface NarrativeDiscoveryEvidenceRef {
  candidate_id: string;
  raw_document_id: string;
  provenance_id: string;
  quote: string;
}

/**
 * A graph-level interpretation of one or more source-grounded candidates.
 * It is intentionally advisory: formal Evidence, Stage, Score, and active
 * Topic promotion are owned by their existing governed workflows.
 */
export interface NarrativeDiscoveryRecord {
  discovery_id: string;
  resolution: NarrativeDiscoveryResolution;
  topic_id: string | null;
  topic_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  scope: 'parent' | 'branch' | null;
  confidence: 'low' | 'medium' | 'high';
  parent_match_score: number;
  branch_novelty_score: number;
  support_count: number;
  independent_document_count: number;
  registration_action: NarrativeDiscoveryRegistrationAction;
  reason: string;
  uncertainty_notes: string[];
  evidence_refs: NarrativeDiscoveryEvidenceRef[];
  audit_required: true;
  guardrail_check: {
    source_quotes_present: boolean;
    duplicate_checked: boolean;
    narrative_memory_checked: boolean;
    parent_stage_unchanged: true;
    branch_evidence_isolated: boolean;
    provisional_does_not_inherit_stage: boolean;
    no_trading_advice: boolean;
  };
}

export interface NarrativeDiscoveryReport {
  artifact_type: 'narrative_discovery_report';
  schema_version: '1.0.0';
  producer_version: string;
  report_id: string;
  generated_at: string;
  session_id: string;
  records: NarrativeDiscoveryRecord[];
  summary: {
    existing_branch_count: number;
    new_branch_count: number;
    provisional_topic_count: number;
    reactivation_count: number;
    unresolved_count: number;
  };
  guardrail_check: {
    source_quotes_present: boolean;
    no_forced_mapping: boolean;
    parent_stage_unchanged: true;
    branch_evidence_isolated: boolean;
    provisional_does_not_inherit_stage: boolean;
    no_trading_advice: boolean;
  };
}
