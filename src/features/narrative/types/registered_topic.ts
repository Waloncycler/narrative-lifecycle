export interface RegisteredNarrativeTopic {
  topic_id: string;
  topic_name: string;
  current_stage: string;
  updated_at: string;
  parent_evidence_ids: string[];
  branches: Array<{
    branch_id: string;
    branch_name: string;
    evidence_ids: string[];
  }>;
}
