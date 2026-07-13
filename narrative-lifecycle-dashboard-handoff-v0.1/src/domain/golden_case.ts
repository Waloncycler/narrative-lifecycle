export interface GoldenCaseRequiredOutputs {
  current_stage: string;
  branch_medical_rehab_stage?: string;
  must_include: string[];
}

export interface GoldenCase {
  topic_id: string;
  topic_name: string;
  baseline_current_stage: string;
  transition_target: string;
  signal_origin?: string;
  key_judgment: string;
  required_outputs: GoldenCaseRequiredOutputs;
  forbidden_outputs: string[];
}
