import type { NarrativeMemory, ReactivationRecord } from './reactivation';
import {
  calculateNarrativeDeltaScore,
  classifyReactivation,
  shouldEnterRadar,
} from '../rules/reactivation_rules';

export function createReactivationRecord(input: {
  record_id: string;
  topic_id: string;
  event_id?: string;
  memory?: NarrativeMemory;
  repeatedOldLogic: boolean;
  missingEvidenceFilled: string[];
  branchMutationStrength: number;
  realityCatchUp: boolean;
  expectationReset: number;
  newEvidenceQuality: number;
  stageGateImpact: number;
  dataConfidence: number;
}): ReactivationRecord {
  const reactivationType = classifyReactivation({
    hasPriorMemory: input.memory !== undefined,
    repeatedOldLogic: input.repeatedOldLogic,
    missingEvidenceFilled: input.missingEvidenceFilled.length > 0,
    branchMutationDetected: input.branchMutationStrength > 0,
    realityCatchUp: input.realityCatchUp,
  });

  const narrativeDeltaScore = calculateNarrativeDeltaScore({
    newEvidenceQuality: input.newEvidenceQuality,
    stageGateImpact: input.stageGateImpact,
    missingEvidenceFilled: input.missingEvidenceFilled.length * 25,
    branchMutationStrength: input.branchMutationStrength,
    expectationReset: input.expectationReset,
    dataConfidence: input.dataConfidence,
  });

  return {
    record_id: input.record_id,
    topic_id: input.topic_id,
    event_id: input.event_id,
    reactivation_type: reactivationType,
    narrative_delta_score: narrativeDeltaScore,
    missing_evidence_filled: input.missingEvidenceFilled,
    branch_mutation_detected: input.branchMutationStrength > 0,
    expectation_reset_detected: input.expectationReset > 0,
    old_story_repetition_risk: input.repeatedOldLogic ? 90 : 10,
    should_enter_radar: shouldEnterRadar(reactivationType, narrativeDeltaScore),
  };
}
