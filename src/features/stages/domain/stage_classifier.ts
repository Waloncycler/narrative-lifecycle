import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import { evidenceForScope, evidenceStrengthRank, isHardRealityEvidence } from '@/features/evidence/domain/evidence';
import type { Stage, StageGateInput, StageSnapshot } from '@/features/stages/domain/stages';
import { capStage } from '@/features/stages/domain/stages';
import { maxAllowedStage, missingStageGateReasons } from '@/features/stages/rules/stage_gate_rules';
import { capStageByDataConfidence } from '@/features/stages/rules/data_confidence_rules';
import { requireEvidenceTable } from '@/features/evidence/domain/evidence_table';

export interface StageClassificationInput {
  evidence: EvidenceNode[];
  scope: 'parent' | 'branch';
  branchId?: string;
  requestedStage?: Stage;
  dataConfidence?: number;
}

export interface StageClassification {
  current_stage: Stage;
  max_allowed_stage: Stage;
  gate_input: StageGateInput;
  why_not_higher_stage: string;
  evidence_ids: string[];
  data_confidence_cap_applied: boolean;
  data_confidence_cap_reason?: string;
}

export function inferStageGateInput(evidence: EvidenceNode[]): StageGateInput {
  // Independent means independent publisher, not a different URL from the
  // same feed. Otherwise ten CoinGecko asset pages become ten fake sources.
  const uniqueSources = new Set<string>();
  for (const item of evidence) {
    uniqueSources.add(sourceIdentity(item));
  }

  const gateEligible = (item: EvidenceNode) => evidenceStrengthRank[item.evidence_strength] >= evidenceStrengthRank.E2;

  return {
    hasStableLabel: evidence.some((item) =>
      gateEligible(item) && (
        item.affected_layer.includes('perception') ||
        item.stage_effect.includes('S3') ||
        item.stage_effect.includes('S4') ||
        item.stage_effect.includes('S5') ||
        item.stage_effect.includes('S6')
      ),
    ),
    hasCapitalConfirmation: evidence.some((item) => gateEligible(item) && item.affected_layer.includes('capital')),
    hasPricingAdoption: evidence.some((item) => gateEligible(item) && item.affected_layer.includes('pricing')),
    hasHardRealityEvidence: evidence.some(isHardRealityEvidence),
    independentSourceCount: uniqueSources.size,
  };
}

function sourceIdentity(item: EvidenceNode): string {
  const sourceName = item.source_name.trim().toLowerCase()
    .replace(/^direct public\s*\/\s*/, '')
    .replace(/\s+/g, ' ');
  if (sourceName) return sourceName;
  if (item.source_url) {
    try { return new URL(item.source_url).hostname.replace(/^www\./, ''); } catch { /* use title fallback */ }
  }
  return item.event_title.trim().toLowerCase();
}

export function classifyStage(input: StageClassificationInput): StageClassification {
  requireEvidenceTable(input.evidence);
  const scopedEvidence = evidenceForScope(input.evidence, input.scope, input.branchId);
  requireEvidenceTable(scopedEvidence);

  const gateInput = inferStageGateInput(scopedEvidence);
  const gateMaximum = maxAllowedStage(gateInput);
  let maximum = gateMaximum;
  const dataConfidenceMaximum = input.dataConfidence !== undefined
    ? capStageByDataConfidence(gateMaximum, input.dataConfidence)
    : undefined;
  if (input.dataConfidence !== undefined) {
    maximum = dataConfidenceMaximum ?? maximum;
  }

  const requestedStage = input.requestedStage ?? maximum;
  const currentStage = capStage(capStageByDataConfidence(requestedStage, input.dataConfidence ?? 100), maximum);
  const missing = missingStageGateReasons(gateInput);
  const reasons = [
    ...missing.map((item) => `Missing ${item}`),
    ...(dataConfidenceMaximum && dataConfidenceMaximum !== gateMaximum
      ? [`Data confidence caps maximum stage at ${dataConfidenceMaximum}`]
      : []),
  ];

  return {
    current_stage: currentStage,
    max_allowed_stage: maximum,
    gate_input: gateInput,
    why_not_higher_stage: reasons.length > 0 ? `${reasons.join('; ')}.` : 'S6 is not safety; monitor continuity, friction, and S7 branch outcomes.',
    evidence_ids: scopedEvidence.map((item) => item.evidence_id),
    data_confidence_cap_applied: Boolean(dataConfidenceMaximum && dataConfidenceMaximum !== gateMaximum),
    data_confidence_cap_reason: dataConfidenceMaximum && dataConfidenceMaximum !== gateMaximum
      ? `Data confidence ${input.dataConfidence} caps maximum stage at ${dataConfidenceMaximum}`
      : undefined,
  };
}

export function toStageSnapshot(classification: StageClassification): StageSnapshot {
  return {
    current_stage: classification.current_stage,
    max_allowed_stage: classification.max_allowed_stage,
    gate_input: classification.gate_input,
    why_not_higher_stage: classification.why_not_higher_stage,
    evidence_ids: classification.evidence_ids,
    data_confidence_cap_applied: classification.data_confidence_cap_applied,
    data_confidence_cap_reason: classification.data_confidence_cap_reason,
  };
}
