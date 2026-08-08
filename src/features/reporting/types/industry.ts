export type IndustryPackStatus = 'matched' | 'provisional' | 'unresolved';

export interface IndustryPack {
  industry_id: string;
  display_name: string;
  aliases: string[];
  topic_hints: string[];
  branch_hints: string[];
  hard_evidence_hints: string[];
  forbidden_inferences: string[];
}

export interface IndustrySuggestion {
  industry_id: string | null;
  status: IndustryPackStatus;
  reason: string;
  alternatives: string[];
}
