import type { EvidenceLayer, EvidenceNode } from './evidence';
import type { ScoreDetails, ScoreResult } from './scoring';
import { calculateDataConfidence } from '../rules/data_confidence_rules';
import { scoreFromEvidence } from '../rules/scoring_rules';
import { maxAllowedStage } from '../rules/stage_gate_rules';
import { stageRank } from './stages';
import { RULE_VERSION } from './versioning_service';
import { requireEvidenceTable } from './evidence_table';
import { inferStageGateInput, toStageSnapshot, type StageClassification } from './stage_classifier';

function assertStageClassificationMatchesEvidence(evidence: EvidenceNode[], stageClassification: StageClassification): void {
  if (stageRank[stageClassification.current_stage] > stageRank[stageClassification.max_allowed_stage]) {
    throw new Error('Stage classification current_stage exceeds its max_allowed_stage');
  }

  const evidenceById = new Map(evidence.map((item) => [item.evidence_id, item]));
  const classifiedEvidence = stageClassification.evidence_ids.map((id) => evidenceById.get(id));

  if (classifiedEvidence.some((item) => item === undefined)) {
    throw new Error('Stage classification evidence_ids must match the Evidence Table before scoring');
  }

  const recomputedMaximum = maxAllowedStage(inferStageGateInput(classifiedEvidence as EvidenceNode[]));
  if (stageRank[stageClassification.max_allowed_stage] > stageRank[recomputedMaximum]) {
    throw new Error('Stage classification does not match Evidence Table gates');
  }
}

export function generateScore(input: {
  score_id: string;
  topic_id: string;
  score_date: string;
  evidence: EvidenceNode[];
  stageClassification: StageClassification;
  missing_data?: string[];
}): ScoreResult {
  requireEvidenceTable(input.evidence);
  if (!input.stageClassification) {
    throw new Error('Stage classification is required before scoring');
  }
  assertStageClassificationMatchesEvidence(input.evidence, input.stageClassification);

  const stageEvidenceIds = new Set(input.stageClassification.evidence_ids);
  const scopedStageEvidence = input.evidence.filter((item) => stageEvidenceIds.has(item.evidence_id));
  const byLayer = (layer: EvidenceLayer) => scopedStageEvidence.filter((item) => item.affected_layer.includes(layer));
  const dimension = (
    evidence: EvidenceNode[],
    reasoning: string,
    missingData: string[],
    presentScore: number,
    fallbackScore: number,
  ) =>
    scoreFromEvidence(
      evidence.length ? evidence : scopedStageEvidence,
      reasoning,
      evidence.length ? [] : missingData,
      evidence.length ? presentScore : fallbackScore,
    );
  const dimensions: ScoreDetails = {};

  dimensions.policy_perception = dimension(
    scopedStageEvidence.filter((item) => item.event_type.includes('policy') || item.source_type === 'policy'),
    'Policy perception uses policy naming and support evidence only when present.',
    ['policy naming and support evidence'],
    60,
    20,
  );
  dimensions.market_perception = dimension(
    byLayer('perception'),
    'Score is derived only from structured evidence that affects perception.',
    input.missing_data ?? [],
    65,
    35,
  );
  dimensions.trading_perception = dimension(
    scopedStageEvidence.filter((item) => item.event_type.includes('label') || item.stage_effect.includes('S3')),
    'Trading perception requires stable label or mapped beneficiary evidence.',
    ['trading label and stock-pool mapping'],
    60,
    25,
  );
  dimensions.capital_confirmation = dimension(
    byLayer('capital'),
    'Capital score uses leader, breadth, volume, or financing evidence when present.',
    ['capital breadth and persistence'],
    65,
    30,
  );
  dimensions.pricing_adoption = dimension(
    byLayer('pricing'),
    'Pricing score requires valuation reframing or financial translation evidence.',
    ['valuation reframing evidence'],
    70,
    25,
  );
  const parentRealityEvidence = scopedStageEvidence.filter(
    (item) => item.affected_layer.includes('reality') && item.parent_or_branch === 'parent',
  );
  const branchRealityEvidence = input.evidence.filter(
    (item) => item.affected_layer.includes('reality') && item.parent_or_branch === 'branch',
  );
  const branchCoverageEvidence = input.evidence.filter(
    (item) => item.parent_or_branch === 'branch' && item.branch_coverage_score !== undefined,
  );

  dimensions.parent_reality = dimension(
    parentRealityEvidence,
    'Parent reality only uses evidence mapped to the parent narrative.',
    ['parent-level orders, revenue, customers, regulatory, clinical, product, or profit evidence'],
    65,
    20,
  );
  dimensions.branch_reality = dimension(
    branchRealityEvidence,
    'Branch reality only uses evidence explicitly mapped to a branch.',
    ['branch-level hard reality evidence'],
    70,
    20,
  );
  dimensions.branch_coverage = dimension(
    branchCoverageEvidence,
    'Branch coverage reflects how representative branch evidence is for the parent narrative.',
    ['branch coverage score'],
    branchCoverageEvidence.length
      ? branchCoverageEvidence.reduce((sum, item) => sum + (item.branch_coverage_score ?? 0), 0) / branchCoverageEvidence.length
      : 25,
    25,
  );
  dimensions.feedback = dimension(
    byLayer('feedback'),
    'Feedback score uses perception-capital-reality loop evidence.',
    ['closed-loop feedback evidence'],
    65,
    25,
  );
  dimensions.execution_friction = dimension(
    byLayer('friction'),
    'Execution friction uses negative execution, regulation, clinical, delivery, or commercialization evidence.',
    ['execution friction evidence'],
    55,
    35,
  );
  dimensions.valuation_friction = dimension(
    scopedStageEvidence.filter((item) => item.event_type.includes('valuation') || item.limitation?.includes('valuation')),
    'Valuation friction uses crowding, saturation, and good-news fatigue evidence.',
    ['valuation friction evidence'],
    55,
    30,
  );
  dimensions.transition_probability = scoreFromEvidence(
    scopedStageEvidence,
    'Transition probability is capped by the completed Stage Gate classification.',
    input.stageClassification.max_allowed_stage === input.stageClassification.current_stage
      ? ['next-stage trigger evidence']
      : [],
    input.stageClassification.current_stage === 'S6' ? 60 : 45,
  );
  dimensions.narrative_delta_score = scoreFromEvidence(
    input.evidence,
    'Narrative delta score requires memory/reactivation inputs; this value reflects structured evidence breadth only.',
    ['Narrative Memory comparison'],
    input.evidence.length >= 3 ? 55 : 35,
  );

  const dataConfidence = calculateDataConfidence({
    sourceBreadth: Math.min(100, input.evidence.length * 25),
    sourceAuthority: 65,
    sourceRecency: 60,
    positiveNegativeBalance: 55,
    layerCoverage: Math.min(100, new Set(input.evidence.flatMap((item) => item.affected_layer)).size * 18),
  });

  dimensions.data_confidence = {
    score: dataConfidence,
    evidence_ids: input.evidence.map((item) => item.evidence_id),
    reasoning: 'Data confidence reflects source breadth, authority, recency, balance, and layer coverage.',
    missing_data: input.missing_data ?? [],
    confidence: dataConfidence,
  };

  return {
    score_id: input.score_id,
    topic_id: input.topic_id,
    score_date: input.score_date,
    stage_snapshot: toStageSnapshot(input.stageClassification),
    dimensions,
    rule_version: RULE_VERSION,
  };
}
