import type { Stage } from './stages';

export interface NarrativeBranch {
  branch_id: string;
  topic_id: string;
  branch_name: string;
  current_stage: Stage | 'S5-S6';
  branch_importance: number;
  branch_coverage_score: number;
  branch_feedback_to_parent: number;
  stage_reasoning?: string;
}

export interface NarrativeTree {
  topic_id: string;
  parent_stage: Stage | 'S5-S6';
  branches: NarrativeBranch[];
}

export function branchCanRepresentParent(branch: NarrativeBranch): boolean {
  return (
    branch.branch_importance >= 70 &&
    branch.branch_coverage_score >= 60 &&
    branch.branch_feedback_to_parent >= 70
  );
}
