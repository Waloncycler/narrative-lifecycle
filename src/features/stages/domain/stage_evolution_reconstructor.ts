/**
 * Stage evolution timeline reconstruction.
 *
 * This is an evidence replay, not a narrative generator. It reconstructs only
 * what the admitted parent Evidence Table can establish in chronological order.
 * A late historical lookup or an incomplete backfill may provide context, but
 * it must never fabricate a continuous S0-S6 path.
 */
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import { inferStageGateInput } from '@/features/stages/domain/stage_classifier';
import { capStageByDataConfidence } from '@/features/stages/rules/data_confidence_rules';
import { maxAllowedStage } from '@/features/stages/rules/stage_gate_rules';
import { stageRank, type Stage, type StageGateInput } from '@/features/stages/domain/stages';

const STAGE_LADDER: Stage[] = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];

export type TimelineHistoryStatus = 'verified' | 'partial' | 'insufficient' | 'no_parent_evidence';
export type TimelineTransitionKind = 'verified_gate_transition' | 'historical_evidence_gap' | 'confidence_regression';

export interface TimelineEvidenceExclusion {
  evidence_id: string;
  reason: 'missing_provenance' | 'unverified_historical_backfill' | 'invalid_chronology';
  event_title?: string;
  event_date?: string;
  source_name?: string;
  source_url?: string;
  missing_fields?: string[];
}

export interface StageTransition {
  from_stage: Stage | 'S0';
  to_stage: Stage;
  transition_date: string;
  available_at: string;
  trigger_evidence_id: string;
  trigger_evidence_title: string;
  trigger_evidence_url: string;
  gate_unlocked: string;
  cumulative_evidence_ids: string[];
  gate_state: {
    hasStableLabel: boolean;
    hasCapitalConfirmation: boolean;
    hasPricingAdoption: boolean;
    hasHardRealityEvidence: boolean;
  };
  /** A true gate transition, a jump with missing historical proof, or a confidence regression. */
  transition_kind: TimelineTransitionKind;
  /** Intermediate stages that this evidence set cannot date independently. */
  missing_intermediate_stages: Stage[];
}

export interface TopicEvolutionTimeline {
  topic_id: string;
  topic_name: string;
  /** Earliest event date among chronology-eligible parent evidence. */
  first_emergence_date: string;
  /** When the system could first have known about an eligible event. */
  first_available_at: string;
  current_stage: Stage | 'S0';
  total_evidence_count: number;
  eligible_parent_evidence_count: number;
  excluded_evidence: TimelineEvidenceExclusion[];
  history_status: TimelineHistoryStatus;
  history_status_reason: string;
  transitions: StageTransition[];
  evolution_path: string;
  evidence_timeline: EvidenceTimelineEntry[];
  /** Read-only system observations. These never replace Evidence Table proof. */
  snapshot_observations?: StageSnapshotObservation[];
}

export interface StageSnapshotObservation {
  observed_at: string;
  stage: string;
  evidence_ids: string[];
  observation_kind: 'topic_registered' | 'stage_snapshot';
}

export interface EvidenceTimelineEntry {
  event_date: string;
  available_at: string;
  evidence_id: string;
  event_title: string;
  source_name: string;
  source_url: string;
  affected_layer: string[];
  evidence_strength: string;
  stage_after: Stage | 'S0';
  max_allowed_after: Stage | 'S0';
  caused_transition: boolean;
}

/**
 * Rebuild one parent-narrative timeline from admitted Evidence Table rows.
 * Branch, asset and unknown-scope rows are deliberately excluded: a branch
 * may have a valid S6 story without proving the parent narrative's S6.
 */
export function reconstructTopicEvolution(
  topicId: string,
  topicName: string,
  allEvidence: EvidenceNode[],
): TopicEvolutionTimeline {
  const topicEvidence = allEvidence.filter((evidence) => evidence.topic_id === topicId);
  const parentEvidence = topicEvidence.filter((evidence) => evidence.parent_or_branch === 'parent' || !evidence.branch_id);
  const exclusions = parentEvidence.flatMap(explainTimelineExclusion);
  const eligible = parentEvidence
    .filter((evidence) => explainTimelineExclusion(evidence).length === 0)
    .sort(compareChronologically);

  if (eligible.length === 0) {
    const status: TimelineHistoryStatus = parentEvidence.length === 0 ? 'no_parent_evidence' : 'insufficient';
    return {
      topic_id: topicId,
      topic_name: topicName,
      first_emergence_date: 'N/A',
      first_available_at: 'N/A',
      current_stage: 'S0',
      total_evidence_count: topicEvidence.length,
      eligible_parent_evidence_count: 0,
      excluded_evidence: exclusions,
      history_status: status,
      history_status_reason: status === 'no_parent_evidence'
        ? '尚无母主题证据；分支证据不会抬高母主题。'
        : '母主题材料尚未满足来源、字段完整性或历史核验要求，不能用于阶段演化。',
      transitions: [],
      evolution_path: 'S0',
      evidence_timeline: [],
    };
  }

  const transitions: StageTransition[] = [];
  const evidenceTimeline: EvidenceTimelineEntry[] = [];
  const accumulated: EvidenceNode[] = [];
  let currentStage: Stage | 'S0' = 'S0';
  const observedStages: Array<Stage | 'S0'> = ['S0'];

  for (const evidence of eligible) {
    const previousGateInput = inferStageGateInput(accumulated);
    accumulated.push(evidence);
    const gateInput = inferStageGateInput(accumulated);
    const newStage = capStageByDataConfidence(maxAllowedStage(gateInput), averageConfidence(accumulated));
    const causedTransition = newStage !== currentStage;

    evidenceTimeline.push({
      event_date: evidence.event_date,
      available_at: evidence.available_at,
      evidence_id: evidence.evidence_id,
      event_title: evidence.event_title,
      source_name: evidence.source_name,
      source_url: evidence.source_url ?? '',
      affected_layer: evidence.affected_layer,
      evidence_strength: evidence.evidence_strength,
      stage_after: newStage,
      max_allowed_after: newStage,
      caused_transition: causedTransition,
    });

    if (!causedTransition) continue;

    const previousRank = stageRank[currentStage];
    const nextRank = stageRank[newStage];
    const isRegression = nextRank < previousRank;
    const missingStages = isRegression ? [] : missingStagesBetween(currentStage, newStage);
    const hasHistoricalGap = missingStages.length > 0;
    const transitionKind: TimelineTransitionKind = isRegression
      ? 'confidence_regression'
      : hasHistoricalGap
        ? 'historical_evidence_gap'
        : 'verified_gate_transition';

    transitions.push({
      from_stage: currentStage,
      to_stage: newStage,
      transition_date: evidence.event_date,
      available_at: evidence.available_at,
      trigger_evidence_id: evidence.evidence_id,
      trigger_evidence_title: evidence.event_title,
      trigger_evidence_url: evidence.source_url ?? '',
      gate_unlocked: describeGateChange(previousGateInput, gateInput, isRegression),
      cumulative_evidence_ids: accumulated.map((item) => item.evidence_id),
      gate_state: gateState(gateInput),
      transition_kind: transitionKind,
      missing_intermediate_stages: missingStages,
    });
    currentStage = newStage;
    if (observedStages.at(-1) !== newStage) observedStages.push(newStage);
  }

  const hasGap = transitions.some((transition) => transition.transition_kind === 'historical_evidence_gap');
  return {
    topic_id: topicId,
    topic_name: topicName,
    first_emergence_date: eligible[0].event_date,
    first_available_at: eligible[0].available_at,
    current_stage: currentStage,
    total_evidence_count: topicEvidence.length,
    eligible_parent_evidence_count: eligible.length,
    excluded_evidence: exclusions,
    history_status: hasGap || exclusions.length ? 'partial' : 'verified',
    history_status_reason: hasGap
      ? '存在跨阶段观测，缺少中间阶段的独立历史证据；系统不会把缺口伪装成连续演化。'
      : exclusions.length
        ? '部分母主题材料未通过时间线核验，已从阶段重建中排除。'
        : '每次阶段变化均由按时间排序的母主题证据重建。',
    transitions,
    evolution_path: observedStages.join(' → '),
    evidence_timeline: evidenceTimeline,
  };
}

export function reconstructAllTopicEvolutions(
  allEvidence: EvidenceNode[],
  topicRegistry: Array<{ topic_id: string; topic_name: string }>,
): TopicEvolutionTimeline[] {
  return topicRegistry.map((topic) => reconstructTopicEvolution(topic.topic_id, topic.topic_name, allEvidence));
}

function explainTimelineExclusion(evidence: EvidenceNode): TimelineEvidenceExclusion[] {
  const details = {
    event_title: evidence.event_title,
    event_date: evidence.event_date,
    source_name: evidence.source_name,
    source_url: evidence.source_url ?? '',
  };
  if (evidence.event_type === 'historical_backfill') {
    return [{ evidence_id: evidence.evidence_id, reason: 'unverified_historical_backfill', ...details }];
  }
  const missingFields = [
    !evidence.source_url && 'source_url',
    !evidence.event_summary?.trim() && 'event_summary',
    !evidence.interpretation?.trim() && 'interpretation',
    !evidence.limitation?.trim() && 'limitation',
  ].filter((field): field is string => Boolean(field));
  if (missingFields.length > 0) {
    return [{ evidence_id: evidence.evidence_id, reason: 'missing_provenance', missing_fields: missingFields, ...details }];
  }
  if (!isValidTimestamp(evidence.event_date) || !isValidTimestamp(evidence.available_at)) {
    return [{ evidence_id: evidence.evidence_id, reason: 'invalid_chronology', ...details }];
  }
  return [];
}

function compareChronologically(left: EvidenceNode, right: EvidenceNode): number {
  return timestamp(left.event_date) - timestamp(right.event_date)
    || timestamp(left.available_at) - timestamp(right.available_at)
    || left.evidence_id.localeCompare(right.evidence_id);
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(timestamp(value));
}

function timestamp(value: string): number {
  return Date.parse(value);
}

function missingStagesBetween(fromStage: Stage | 'S0', toStage: Stage): Stage[] {
  const fromRank = stageRank[fromStage];
  const toRank = stageRank[toStage];
  if (toRank <= fromRank + 1) return [];
  // S1 is an observational state without a formal gate. It is never invented
  // by the reconstruction; S0 -> S2 is the valid first-admitted-evidence step.
  return STAGE_LADDER.slice(fromRank + 1, toRank).filter((stage) => stage !== 'S1');
}

function describeGateChange(previous: StageGateInput, next: StageGateInput, regression: boolean): string {
  if (regression) return 'data_confidence_regression';
  const changed = [
    ['stable_label', !previous.hasStableLabel && next.hasStableLabel],
    ['capital_confirmation', !previous.hasCapitalConfirmation && next.hasCapitalConfirmation],
    ['pricing_adoption', !previous.hasPricingAdoption && next.hasPricingAdoption],
    ['hard_reality_evidence', !previous.hasHardRealityEvidence && next.hasHardRealityEvidence],
    ['independent_sources', previous.independentSourceCount < next.independentSourceCount],
  ].filter(([, changed]) => changed).map(([name]) => name);
  return changed.join(' + ') || 'cumulative_evidence';
}

function gateState(input: StageGateInput): StageTransition['gate_state'] {
  return {
    hasStableLabel: input.hasStableLabel,
    hasCapitalConfirmation: input.hasCapitalConfirmation,
    hasPricingAdoption: input.hasPricingAdoption,
    hasHardRealityEvidence: input.hasHardRealityEvidence,
  };
}

function averageConfidence(evidence: EvidenceNode[]): number {
  const values = evidence.map((item) => item.confidence).filter((item): item is number => typeof item === 'number');
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 45;
}
