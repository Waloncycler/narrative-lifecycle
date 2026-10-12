export type ReactivationType =
  | 'new_topic'
  | 'dormant_signal_reactivation'
  | 'stage_reactivation'
  | 'branch_mutation'
  | 'reality_catch_up'
  | 'expectation_reset'
  | 'repeated_old_story'
  | 'failed_revival_attempt'
  | 'noise';

export function shouldEnterRadar(type: ReactivationType, narrativeDeltaScore: number): boolean {
  if (type === 'noise') return false;
  if (type === 'repeated_old_story') return narrativeDeltaScore >= 85;
  return narrativeDeltaScore >= 41;
}

export interface NarrativeDeltaInput {
  newEvidenceQuality: number;
  stageGateImpact: number;
  missingEvidenceFilled: number;
  branchMutationStrength: number;
  expectationReset: number;
  dataConfidence: number;
}

export function calculateNarrativeDeltaScore(input: NarrativeDeltaInput): number {
  const score =
    input.newEvidenceQuality * 0.25 +
    input.stageGateImpact * 0.25 +
    input.missingEvidenceFilled * 0.2 +
    input.branchMutationStrength * 0.15 +
    input.expectationReset * 0.1 +
    input.dataConfidence * 0.05;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyReactivation(input: {
  hasPriorMemory: boolean;
  repeatedOldLogic: boolean;
  missingEvidenceFilled: boolean;
  branchMutationDetected: boolean;
  realityCatchUp: boolean;
}): ReactivationType {
  if (!input.hasPriorMemory) return 'new_topic';
  if (input.repeatedOldLogic && !input.missingEvidenceFilled && !input.branchMutationDetected) {
    return 'repeated_old_story';
  }
  if (input.branchMutationDetected) return 'branch_mutation';
  if (input.realityCatchUp) return 'reality_catch_up';
  if (input.missingEvidenceFilled) return 'stage_reactivation';
  return 'dormant_signal_reactivation';
}
