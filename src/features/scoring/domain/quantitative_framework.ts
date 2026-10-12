import type { EvidenceLayer, EvidenceNode, EvidenceStrength } from '@/features/evidence/domain/evidence';
import type { StageGateInput } from '@/features/stages/domain/stages';

export const QUANTITATIVE_RULE_VERSION = 'quantitative-framework-v0.3.0-shadow';

const strengthWeights: Record<EvidenceStrength, number> = {
  E0: 0,
  E1: 0.15,
  E2: 0.4,
  E3: 0.7,
  E4: 0.9,
};

const authorityWeights: Record<string, number> = {
  regulator: 0.95,
  regulatory: 0.95,
  policy: 0.95,
  filing: 0.9,
  official: 0.9,
  research: 0.75,
  company: 0.7,
  media: 0.6,
  other: 0.5,
  social: 0.25,
};

export interface EvidenceContribution {
  evidence_id: string;
  quality: number;
  signed_quality: number;
  strength_weight: number;
  authority_weight: number;
  confidence_weight: number;
  recency_weight: number;
}

export interface LayerSupport {
  layer: EvidenceLayer;
  positive_support: number;
  negative_support: number;
  net_support: number;
  independent_source_count: number;
  evidence_ids: string[];
}

export interface DataConfidenceBreakdown {
  score: number;
  source_breadth: number;
  source_authority: number;
  source_recency: number;
  polarity_coverage: number;
  layer_coverage: number;
}

export interface TransitionReadiness {
  score: number;
  gate_completion: number;
  data_confidence: number;
  friction_penalty: number;
  calibration_status: 'uncalibrated';
  interpretation: string;
}

export interface NarrativeDeltaInput {
  memoryAvailable: boolean;
  newEvidenceQuality: number;
  gateImpact: number;
  missingEvidenceFilled: number;
  branchMutationStrength: number;
  expectationReset: number;
  dataConfidence: number;
}

export interface NarrativeDelta {
  score: number | null;
  calibration_status: 'available' | 'insufficient_memory';
  components: Omit<NarrativeDeltaInput, 'memoryAvailable'>;
}

export interface AgentEvaluationInput {
  sampleSize: number;
  citationAccuracy: number;
  fieldAccuracy: number;
  resolverAccuracy: number;
  factRecall: number;
  unsupportedClaimRate: number;
  parentBranchErrorRate: number;
  e3e4OverstatementRate: number;
  costPerRun: number;
  maxCostPerRun: number;
  latencyMs: number;
  maxLatencyMs: number;
}

export interface AgentOptimizationResult {
  quality_score: number;
  efficiency_score: number;
  optimization_score: number;
  eligible_for_reviewed_promotion: boolean;
  blockers: string[];
}

export interface CircuitBreakerInput {
  costPerRun: number;
  maxCostPerRun: number;
  consecutiveFailures: number;
  rollingErrorRate: number;
  rollingSampleSize: number;
  rateVsBaseline: number;
  retryCount: number;
  maxRetries: number;
}

export function evidenceContribution(
  evidence: EvidenceNode,
  asOf: string,
  recencyHalfLifeDays = 180,
): EvidenceContribution {
  const strengthWeight = strengthWeights[evidence.evidence_strength];
  const authorityWeight = sourceAuthorityWeight(evidence.source_type);
  const confidenceWeight = clamp01((evidence.confidence ?? 60) / 100);
  const recencyWeight = recencyDecay(evidence.available_at, asOf, recencyHalfLifeDays);
  const quality = round100(100 * strengthWeight * authorityWeight * confidenceWeight * recencyWeight);
  const polaritySign = evidence.positive_or_negative === 'negative' ? -1 : evidence.positive_or_negative === 'neutral' ? 0 : 1;

  return {
    evidence_id: evidence.evidence_id,
    quality,
    signed_quality: round100(quality * polaritySign),
    strength_weight: strengthWeight,
    authority_weight: authorityWeight,
    confidence_weight: confidenceWeight,
    recency_weight: recencyWeight,
  };
}

export function aggregateLayerSupport(
  evidence: EvidenceNode[],
  layer: EvidenceLayer,
  asOf: string,
): LayerSupport {
  const relevant = evidence.filter((item) => item.affected_layer.includes(layer) && item.evidence_strength !== 'E0');
  const sources = new Map<string, { positive: number; negative: number }>();

  for (const item of relevant) {
    const contribution = evidenceContribution(item, asOf);
    const sourceKey = item.source_name.trim().toLowerCase() || item.evidence_id;
    const current = sources.get(sourceKey) ?? { positive: 0, negative: 0 };
    if (contribution.signed_quality > 0) current.positive = Math.max(current.positive, contribution.quality);
    if (contribution.signed_quality < 0) current.negative = Math.max(current.negative, contribution.quality);
    sources.set(sourceKey, current);
  }

  const positiveSupport = noisyOr(Array.from(sources.values(), (item) => item.positive));
  const negativeSupport = noisyOr(Array.from(sources.values(), (item) => item.negative));

  return {
    layer,
    positive_support: positiveSupport,
    negative_support: negativeSupport,
    net_support: round100(Math.max(0, positiveSupport - negativeSupport)),
    independent_source_count: sources.size,
    evidence_ids: relevant.map((item) => item.evidence_id),
  };
}

export function computeDataConfidence(evidence: EvidenceNode[], asOf: string): DataConfidenceBreakdown {
  if (evidence.length === 0) {
    return {
      score: 0,
      source_breadth: 0,
      source_authority: 0,
      source_recency: 0,
      polarity_coverage: 0,
      layer_coverage: 0,
    };
  }

  const valid = evidence.filter((item) => item.evidence_strength !== 'E0');
  if (valid.length === 0) return computeDataConfidence([], asOf);
  const uniqueSources = new Set(valid.map((item) => item.source_name.trim().toLowerCase())).size;
  const sourceBreadth = 100 * (1 - Math.exp(-uniqueSources / 3));
  const sourceAuthority = average(valid.map((item) => 100 * sourceAuthorityWeight(item.source_type)));
  const sourceRecency = average(valid.map((item) => 100 * recencyDecay(item.available_at, asOf, 180)));
  const hasPositive = valid.some((item) => item.positive_or_negative === 'positive' || item.positive_or_negative === undefined);
  const hasNegative = valid.some((item) => item.positive_or_negative === 'negative');
  const hasNeutral = valid.some((item) => item.positive_or_negative === 'neutral');
  const polarityCoverage = hasPositive && hasNegative ? 100 : hasNeutral ? 60 : 40;
  const layerCoverage = 100 * new Set(valid.flatMap((item) => item.affected_layer)).size / 6;
  const score = 0.25 * sourceBreadth
    + 0.25 * sourceAuthority
    + 0.2 * sourceRecency
    + 0.15 * polarityCoverage
    + 0.15 * layerCoverage;

  return {
    score: round100(score),
    source_breadth: round100(sourceBreadth),
    source_authority: round100(sourceAuthority),
    source_recency: round100(sourceRecency),
    polarity_coverage: round100(polarityCoverage),
    layer_coverage: round100(layerCoverage),
  };
}

export function computeTransitionReadiness(input: {
  gateInput: StageGateInput;
  dataConfidence: number;
  frictionSupport: number;
}): TransitionReadiness {
  const gateCompletion = (
    Number(input.gateInput.hasStableLabel) * 0.2
    + Number(input.gateInput.hasCapitalConfirmation) * 0.25
    + Number(input.gateInput.hasPricingAdoption) * 0.25
    + Number(input.gateInput.hasHardRealityEvidence) * 0.3
  );
  const confidence = clamp01(input.dataConfidence / 100);
  const frictionPenalty = clamp01(input.frictionSupport / 100);
  const score = 100 * gateCompletion * confidence * (1 - frictionPenalty);

  return {
    score: round100(score),
    gate_completion: round100(100 * gateCompletion),
    data_confidence: round100(input.dataConfidence),
    friction_penalty: round100(input.frictionSupport),
    calibration_status: 'uncalibrated',
    interpretation: 'Readiness index only; it is not an empirical transition probability until replay outcomes calibrate it.',
  };
}

export function computeNarrativeDelta(input: NarrativeDeltaInput): NarrativeDelta {
  const components = {
    newEvidenceQuality: clamp100(input.newEvidenceQuality),
    gateImpact: clamp100(input.gateImpact),
    missingEvidenceFilled: clamp100(input.missingEvidenceFilled),
    branchMutationStrength: clamp100(input.branchMutationStrength),
    expectationReset: clamp100(input.expectationReset),
    dataConfidence: clamp100(input.dataConfidence),
  };
  if (!input.memoryAvailable) {
    return { score: null, calibration_status: 'insufficient_memory', components };
  }

  const score = 0.2 * components.newEvidenceQuality
    + 0.25 * components.gateImpact
    + 0.2 * components.missingEvidenceFilled
    + 0.15 * components.branchMutationStrength
    + 0.1 * components.expectationReset
    + 0.1 * components.dataConfidence;

  return { score: round100(score), calibration_status: 'available', components };
}

export function evaluateAgentOptimization(input: AgentEvaluationInput): AgentOptimizationResult {
  const quality = 100 * (
    0.35 * clamp01(input.citationAccuracy)
    + 0.2 * clamp01(input.fieldAccuracy)
    + 0.2 * clamp01(input.resolverAccuracy)
    + 0.15 * clamp01(input.factRecall)
    + 0.1 * (1 - clamp01(input.unsupportedClaimRate))
  );
  const penalty = 100 * (
    0.4 * clamp01(input.unsupportedClaimRate)
    + 0.35 * clamp01(input.parentBranchErrorRate)
    + 0.25 * clamp01(input.e3e4OverstatementRate)
  );
  const qualityScore = clamp100(quality - penalty);
  const costEfficiency = input.costPerRun <= 0
    ? 100
    : 100 * clamp01(input.maxCostPerRun / input.costPerRun);
  const latencyEfficiency = input.latencyMs <= 0
    ? 100
    : 100 * clamp01(input.maxLatencyMs / input.latencyMs);
  const efficiencyScore = 0.6 * costEfficiency + 0.4 * latencyEfficiency;
  const optimizationScore = 0.8 * qualityScore + 0.2 * efficiencyScore;
  const blockers: string[] = [];

  if (input.sampleSize < 50) blockers.push('minimum 50 reviewed samples');
  if (input.citationAccuracy < 0.95) blockers.push('citation accuracy below 95%');
  if (input.unsupportedClaimRate > 0.02) blockers.push('unsupported claim rate above 2%');
  if (input.parentBranchErrorRate > 0.01) blockers.push('Parent/Branch error rate above 1%');
  if (input.e3e4OverstatementRate > 0.02) blockers.push('E3/E4 overstatement rate above 2%');
  if (input.costPerRun > input.maxCostPerRun) blockers.push('cost per run exceeds budget');
  if (input.latencyMs > input.maxLatencyMs) blockers.push('latency exceeds budget');

  return {
    quality_score: round100(qualityScore),
    efficiency_score: round100(efficiencyScore),
    optimization_score: round100(optimizationScore),
    eligible_for_reviewed_promotion: blockers.length === 0,
    blockers,
  };
}

export function circuitBreakerReasons(input: CircuitBreakerInput): string[] {
  const reasons: string[] = [];
  if (input.costPerRun > input.maxCostPerRun) reasons.push('cost_budget_exceeded');
  if (input.consecutiveFailures >= 3) reasons.push('consecutive_failures');
  if (input.rollingSampleSize >= 10 && input.rollingErrorRate > 0.2) reasons.push('rolling_error_rate');
  if (input.rateVsBaseline >= 5) reasons.push('traffic_spike');
  if (input.retryCount >= input.maxRetries) reasons.push('retry_budget_exhausted');
  return reasons;
}

export function calculateModelCost(input: {
  inputTokens: number;
  outputTokens: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}): number {
  return (
    input.inputTokens * input.inputCostPerMillion
    + input.outputTokens * input.outputCostPerMillion
  ) / 1_000_000;
}

function noisyOr(values: number[]): number {
  const remaining = values.reduce((product, value) => product * (1 - clamp01(value / 100)), 1);
  return round100(100 * (1 - remaining));
}

function sourceAuthorityWeight(sourceType?: string): number {
  return authorityWeights[(sourceType ?? 'other').toLowerCase()] ?? authorityWeights.other;
}

function recencyDecay(availableAt: string, asOf: string, halfLifeDays: number): number {
  const available = Date.parse(availableAt);
  const current = Date.parse(asOf);
  if (!Number.isFinite(available) || !Number.isFinite(current) || halfLifeDays <= 0) return 0;
  const ageDays = Math.max(0, (current - available) / 86_400_000);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function round100(value: number): number {
  return Math.round(clamp100(value) * 100) / 100;
}
