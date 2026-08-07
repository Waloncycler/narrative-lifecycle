import { expressionIncludesStage } from '../domain/stages';

export interface BranchLiftInput {
  branchStage: string;
  branchImportance: number;
  branchCoverageScore: number;
  branchFeedbackToParent: number;
}

function hasS6BranchStage(branchStage: string): boolean {
  try {
    return expressionIncludesStage(branchStage, 'S6');
  } catch {
    return false;
  }
}

export function canBranchLiftParentToS6(input: BranchLiftInput): boolean {
  return (
    hasS6BranchStage(input.branchStage) &&
    input.branchImportance >= 70 &&
    input.branchCoverageScore >= 60 &&
    input.branchFeedbackToParent >= 70
  );
}
