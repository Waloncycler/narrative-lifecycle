import type { EvidenceNode } from './evidence';
import { classifyStage } from './stage_classifier';
import type { Stage } from './stages';
import { isStage } from './stages';
import type { ReplayBranchResult, ReplayCase } from '../types/replay';

const forbiddenAdvicePattern = /\b(buy|sell|entry|exit|position|target price|stop loss)\b|\b(go|going|went)\s+(long|short)\b|\b(long|short)\s+(trade|position|call|idea)\b/i;

export function evidenceAvailableAt(evidence: EvidenceNode[], asOf: string): EvidenceNode[] {
  return evidence.filter((item) => item.available_at <= asOf);
}

export function futureEvidenceIds(evidence: EvidenceNode[], asOf: string): string[] {
  return evidence.filter((item) => item.available_at > asOf).map((item) => item.evidence_id).sort();
}

export function noFutureEvidenceUsed(evidence: EvidenceNode[], asOf: string): boolean {
  return evidence.every((item) => item.available_at <= asOf);
}

export function noTradingAdvice(value: unknown): boolean {
  return !forbiddenAdvicePattern.test(JSON.stringify(value));
}

export function validateReplayCase(replayCase: ReplayCase): string[] {
  const errors: string[] = [];
  if (!replayCase.case_id) errors.push('case_id is required');
  if (!replayCase.topic_id) errors.push(`${replayCase.case_id}: topic_id is required`);
  if (!replayCase.slices.length) errors.push(`${replayCase.case_id}: at least one time slice is required`);
  if (!replayCase.evidence.length) errors.push(`${replayCase.case_id}: evidence is required`);
  if (!replayCase.outcome.summary) errors.push(`${replayCase.case_id}: outcome summary is required`);
  if (forbiddenAdvicePattern.test(JSON.stringify(replayCase))) errors.push(`${replayCase.case_id}: trading advice terms are not allowed`);
  for (const evidence of replayCase.evidence) {
    if (!evidence.available_at) errors.push(`${replayCase.case_id}/${evidence.evidence_id}: available_at is required`);
    if (evidence.available_at && evidence.event_date && evidence.available_at < evidence.event_date) {
      errors.push(`${replayCase.case_id}/${evidence.evidence_id}: available_at cannot be before event_date`);
    }
  }
  return errors;
}

export function parentStageForReplay(input: {
  evidence: EvidenceNode[];
  requestedStage: string;
  dataConfidence: number;
}): { current_stage: string; max_allowed_stage: string; why_not_higher_stage: string; evidence_ids: string[] } {
  const parentEvidence = input.evidence.filter((item) => item.parent_or_branch === 'parent');
  if (!parentEvidence.length) {
    return {
      current_stage: 'S0',
      max_allowed_stage: 'S0',
      why_not_higher_stage: 'No parent Evidence Table rows were available at this slice.',
      evidence_ids: [],
    };
  }
  const requested = stageForClassifier(input.requestedStage, parentEvidence);
  const classification = classifyStage({
    evidence: parentEvidence,
    scope: 'parent',
    requestedStage: requested,
    dataConfidence: input.dataConfidence,
  });
  const stateStage = stateStageFor(parentEvidence, 'parent', classification.current_stage);
  return {
    current_stage: stateStage,
    max_allowed_stage: classification.max_allowed_stage,
    why_not_higher_stage: stateStage === classification.current_stage
      ? classification.why_not_higher_stage
      : `${stateStage} state evidence is present; still verify continuity and failure signals.`,
    evidence_ids: classification.evidence_ids,
  };
}

export function branchStagesForReplay(evidence: EvidenceNode[], dataConfidence: number): ReplayBranchResult[] {
  const branchIds = Array.from(new Set(evidence
    .filter((item) => item.parent_or_branch === 'branch' && item.branch_id)
    .map((item) => item.branch_id as string))).sort();

  return branchIds.map((branchId) => {
    const branchEvidence = evidence.filter((item) => item.parent_or_branch === 'branch' && item.branch_id === branchId);
    const requested = stageForClassifier('S6', branchEvidence);
    const classification = classifyStage({
      evidence: branchEvidence,
      scope: 'branch',
      branchId,
      requestedStage: requested,
      dataConfidence,
    });
    return {
      branch_id: branchId,
      current_stage: stateStageFor(branchEvidence, 'branch', classification.current_stage),
      evidence_ids: classification.evidence_ids,
    };
  });
}

function stageForClassifier(requestedStage: string, evidence: EvidenceNode[]): Stage {
  if (evidence.some((item) => item.stage_effect.includes('S6') || item.stage_effect.includes('S7'))) return 'S6';
  if (evidence.some((item) => item.stage_effect.includes('S5'))) return 'S5';
  if (evidence.some((item) => item.stage_effect.includes('S4'))) return 'S4';
  if (evidence.some((item) => item.stage_effect.includes('S3'))) return 'S3';
  if (isStage(requestedStage) && requestedStage !== 'S7A' && requestedStage !== 'S7B' && requestedStage !== 'S7C') return requestedStage;
  return 'S6';
}

function stateStageFor(evidence: EvidenceNode[], scope: 'parent' | 'branch', fallback: string): string {
  const joined = evidence.map((item) => item.stage_effect).join(' ');
  if (joined.includes('S7C') && scope === 'branch') return 'S7C';
  if (joined.includes('S7B') && scope === 'parent') return 'S7B';
  if (joined.includes('S7A') && scope === 'parent') return 'S7A';
  return fallback;
}
