import type { Stage, StageGateInput } from '../domain/stages';
import { capStage } from '../domain/stages';

export function maxAllowedStage(input: StageGateInput): Stage {
  if (!input.hasStableLabel) return 'S2';
  if (!input.hasCapitalConfirmation) return 'S3';
  if (!input.hasPricingAdoption) return 'S4';
  if (!input.hasHardRealityEvidence) return 'S5';
  return 'S6';
}

export function applyStageGate(requestedStage: Stage, input: StageGateInput): Stage {
  return capStage(requestedStage, maxAllowedStage(input));
}

export function missingStageGateReasons(input: StageGateInput): string[] {
  const missing: string[] = [];
  if (!input.hasStableLabel) missing.push('stable label');
  if (!input.hasCapitalConfirmation) missing.push('capital confirmation');
  if (!input.hasPricingAdoption) missing.push('pricing adoption');
  if (!input.hasHardRealityEvidence) missing.push('hard reality evidence');
  return missing;
}
