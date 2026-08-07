export type TopicDiscoveryKind = 'new_topic' | 'new_branch' | 'alias_of' | 'reactivation' | 'unresolved';
export type TopicDiscoveryStatus = 'pending' | 'accepted' | 'rejected' | 'deferred';

export interface TopicDiscoveryEvidenceRef {
  candidate_id: string;
  quote: string;
  provenance_id: string;
  evidence_id: string | null;
}

export interface TopicDiscoveryProposal {
  artifact_type: 'topic_discovery_proposal';
  schema_version: '1.0.0';
  producer_version: string;
  proposal_id: string;
  generated_at: string;
  session_id: string | null;
  kind: TopicDiscoveryKind;
  status: TopicDiscoveryStatus;
  proposed_topic_id: string | null;
  proposed_topic_name: string | null;
  parent_topic_id: string | null;
  proposed_branch_id: string | null;
  proposed_branch_name: string | null;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  uncertainty_notes: string[];
  alternatives: Array<{ topic_id: string | null; branch_id: string | null; status: string; reason: string }>;
  narrative_memory_match: boolean;
  evidence_refs: TopicDiscoveryEvidenceRef[];
  audit_required: true;
  operator_decision?: { reviewer: string; decided_at: string; note?: string };
}
