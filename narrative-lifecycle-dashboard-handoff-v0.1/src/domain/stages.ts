export type Stage = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7A' | 'S7B' | 'S7C';
export type StageExpressionKind = 'single' | 'range' | 'alternatives';

export interface StageExpression {
  raw: string;
  kind: StageExpressionKind;
  stages: Stage[];
}

export const stageOrder: Stage[] = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7A', 'S7B', 'S7C'];

export const stageRank: Record<Stage, number> = {
  S0: 0,
  S1: 1,
  S2: 2,
  S3: 3,
  S4: 4,
  S5: 5,
  S6: 6,
  S7A: 7,
  S7B: 7,
  S7C: 7,
};

export interface StageGateInput {
  hasStableLabel: boolean;
  hasCapitalConfirmation: boolean;
  hasPricingAdoption: boolean;
  hasHardRealityEvidence: boolean;
}

export interface StageSnapshot {
  current_stage: string;
  max_allowed_stage: string;
  why_not_higher_stage: string;
  evidence_ids: string[];
  data_confidence_cap_applied: boolean;
  data_confidence_cap_reason?: string;
}

export function isStage(value: string): value is Stage {
  return stageOrder.includes(value as Stage);
}

export function parseStageExpression(value: string): StageExpression {
  const separator = value.includes('/') ? '/' : value.includes('-') ? '-' : undefined;
  const stages = separator ? value.split(separator) : [value];

  if (stages.length === 0 || stages.some((stage) => !isStage(stage))) {
    throw new Error(`Invalid stage expression: ${value}`);
  }

  return {
    raw: value,
    kind: separator === '-' ? 'range' : separator === '/' ? 'alternatives' : 'single',
    stages: stages as Stage[],
  };
}

export function maxStageInExpression(value: string): Stage {
  const expression = parseStageExpression(value);
  return expression.stages.reduce((highest, stage) => (stageRank[stage] > stageRank[highest] ? stage : highest), expression.stages[0]);
}

export function expressionIncludesStage(value: string, stage: Stage): boolean {
  return parseStageExpression(value).stages.includes(stage);
}

export function isAtOrBelow(stage: Stage, maximum: Stage): boolean {
  return stageRank[stage] <= stageRank[maximum];
}

export function capStage(stage: Stage, maximum: Stage): Stage {
  return isAtOrBelow(stage, maximum) ? stage : maximum;
}

export function isEarlyRadarStage(stage: Stage): boolean {
  return stageRank[stage] >= stageRank.S1 && stageRank[stage] <= stageRank.S4;
}
