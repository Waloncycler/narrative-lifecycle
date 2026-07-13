import { describe, expect, it } from 'vitest';
import { canBranchLiftParentToS6 } from '../src/rules/branch_pollution_rules';

describe('branch pollution rule', () => {
  it('does not allow low-coverage branch S6 to upgrade parent', () => {
    expect(canBranchLiftParentToS6({ branchStage: 'S5-S6', branchImportance: 80, branchCoverageScore: 45, branchFeedbackToParent: 70 })).toBe(false);
  });

  it('allows review only when branch importance, coverage, and feedback are high', () => {
    expect(canBranchLiftParentToS6({ branchStage: 'S6', branchImportance: 85, branchCoverageScore: 75, branchFeedbackToParent: 80 })).toBe(true);
  });

  it('requires an explicit S6 branch stage token', () => {
    expect(canBranchLiftParentToS6({ branchStage: 'S16', branchImportance: 85, branchCoverageScore: 75, branchFeedbackToParent: 80 })).toBe(false);
  });
});
