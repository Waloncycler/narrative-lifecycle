import type { Stage } from '../domain/stages';
import { capStage } from '../domain/stages';

export interface DataConfidenceInput {
  sourceBreadth: number;
  sourceAuthority: number;
  sourceRecency: number;
  positiveNegativeBalance: number;
  layerCoverage: number;
}

export function calculateDataConfidence(input: DataConfidenceInput): number {
  const values = [
    input.sourceBreadth,
    input.sourceAuthority,
    input.sourceRecency,
    input.positiveNegativeBalance,
    input.layerCoverage,
  ];

  return Math.round(values.reduce((sum, value) => sum + Math.max(0, Math.min(100, value)), 0) / values.length);
}

export function maximumStageByDataConfidence(dataConfidence: number): Stage {
  if (dataConfidence < 35) return 'S3';
  if (dataConfidence < 50) return 'S4';
  if (dataConfidence < 65) return 'S5';
  return 'S6';
}

export function capStageByDataConfidence(stage: Stage, dataConfidence: number): Stage {
  return capStage(stage, maximumStageByDataConfidence(dataConfidence));
}
