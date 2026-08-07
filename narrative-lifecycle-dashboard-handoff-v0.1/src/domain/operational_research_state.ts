import { classifyStage, type StageClassification } from './stage_classifier';
import { generateScore } from './scoring_engine';
import { stageRank, type Stage } from './stages';
import type { EvidenceNode } from './evidence';
import type { ScoreResult } from './scoring';
import type { StageSnapshotHistory, StageSnapshotTopic } from '../types/diff';
import type { TopicRegistry } from '../types/topic_resolution';
import { artifactMetadata } from '../types/artifact_contract';
import { RULE_VERSION } from './versioning_service';
import { marketBranchName, marketTopicName } from './market_naming';

export interface OperationalResearchState {
  snapshot: StageSnapshotHistory;
  scores: ScoreResult[];
}

/** Builds live topic state from the formal operational Evidence Table only. */
export function buildOperationalResearchState(input: {
  registry: TopicRegistry;
  evidence: EvidenceNode[];
  runId: string;
  generatedAt: string;
}): OperationalResearchState {
  const scores: ScoreResult[] = [];
  const topics = input.registry.canonical_topics
    .filter((topic) => topic.status !== 'archived')
    .map((topic) => {
      const evidence = input.evidence.filter((item) => item.topic_id === topic.topic_id);
      // Active narratives remain visible at S0 when their formal Evidence
      // Table is empty. Provisional entries stay out of the live view until
      // they have admissible evidence, avoiding a dashboard full of dormant
      // speculative topics.
      if (!evidence.length && topic.status !== 'active') return null;
      const state = topicState(topic.topic_id, marketTopicName(topic), evidence, input.registry, input.generatedAt, scores);
      return state;
    })
    .filter((item): item is StageSnapshotTopic => item !== null);

  return {
    snapshot: {
      ...artifactMetadata({
        artifact_type: 'stage_snapshot_history',
        rule_version: RULE_VERSION,
        run_id: input.runId,
        generated_at: input.generatedAt,
      }),
      snapshot_id: `stage_snapshot_${input.runId}`,
      run_id: input.runId,
      generated_at: input.generatedAt,
      source_report_id: `weekly_brief_${input.runId}`,
      topics,
      early_radar_candidates: [],
      guardrail_check: {
        no_trading_advice: true,
        research_only_actions: true,
        parent_branch_separation_preserved: topics.every((topic) => topic.branches.every((branch) => !topic.evidence_ids.includes(branch.evidence_ids[0] ?? '__none__'))),
        evidence_ids_visible: topics.every((topic) => topic.current_stage === 'S0' || topic.evidence_ids.length > 0 || topic.branches.some((branch) => branch.evidence_ids.length > 0)),
        why_not_higher_present: topics.every((topic) => Boolean(topic.why_not_higher_stage)),
        data_confidence_present: topics.every((topic) => ['low', 'medium', 'high'].includes(topic.data_confidence)),
      },
    },
    scores,
  };
}

function topicState(
  topicId: string,
  topicName: string,
  evidence: EvidenceNode[],
  registry: TopicRegistry,
  generatedAt: string,
  scores: ScoreResult[],
): StageSnapshotTopic {
  const topicEvidence = evidence.filter((item) => item.topic_id === topicId);
  const parentEvidence = topicEvidence.filter((item) => item.parent_or_branch === 'parent' || !item.branch_id);
  const branchIds = new Set([
    ...registry.branches.filter((branch) => branch.topic_id === topicId).map((branch) => branch.branch_id),
    ...evidence.filter((item) => item.topic_id === topicId && item.parent_or_branch === 'branch' && item.branch_id).map((item) => item.branch_id as string),
  ]);
  const branches = [...branchIds].map((branchId) => branchState(branchId, evidence, registry, topicId));

  if (!parentEvidence.length) {
    return {
      topic_id: topicId,
      topic_name: topicName,
      parent_narrative: topicName,
      current_stage: 'S0',
      gate_stage: 'S0',
      max_allowed_stage: 'S0',
      strongest_branch: strongestBranch(branches),
      weakest_layer: 'parent Evidence Table',
      data_confidence: 'low',
      evidence_ids: [],
      score_id: `score_unavailable_${topicId}`,
      dashboard_card_id: `card_operational_${topicId}`,
      why_not_higher_stage: 'No parent Evidence Table is available. Branch evidence is shown separately and cannot upgrade the parent narrative.',
      gate_why_not_higher_stage: 'No parent Evidence Table is available.',
      gate_evidence_ids: [],
      branches,
    };
  }

  const parentConfidence = averageConfidence(parentEvidence);
  const stage = classifyStage({ evidence: parentEvidence, scope: 'parent', dataConfidence: parentConfidence });
  const score = generateScore({
    score_id: `score_operational_${topicId}_${generatedAt.slice(0, 10).replaceAll('-', '')}`,
    topic_id: topicId,
    score_date: generatedAt.slice(0, 10),
    evidence: parentEvidence,
    stageClassification: stage,
    missing_data: missingLayers(stage),
  });
  scores.push(score);
  return {
    topic_id: topicId,
    topic_name: topicName,
    parent_narrative: topicName,
    current_stage: stage.current_stage,
    gate_stage: stage.current_stage,
    max_allowed_stage: stage.max_allowed_stage,
    strongest_branch: strongestBranch(branches),
    weakest_layer: weakestScoreLayer(score),
    data_confidence: confidenceBand(score.dimensions.data_confidence?.score ?? parentConfidence),
    evidence_ids: parentEvidence.map((item) => item.evidence_id).sort(),
    score_id: score.score_id,
    dashboard_card_id: `card_operational_${topicId}`,
    why_not_higher_stage: stage.why_not_higher_stage,
    gate_why_not_higher_stage: stage.why_not_higher_stage,
    gate_evidence_ids: stage.evidence_ids.sort(),
    branches,
  };
}

function branchState(branchId: string, evidence: EvidenceNode[], registry: TopicRegistry, topicId: string): StageSnapshotTopic['branches'][number] {
  const branchEvidence = evidence.filter((item) => item.parent_or_branch === 'branch' && item.branch_id === branchId);
  const registered = registry.branches.find((item) => item.branch_id === branchId);
  const name = registered ? marketBranchName(registered) : branchId.replace(/_/g, ' ');
  if (!branchEvidence.length) return { branch_id: branchId, branch_name: name, current_stage: 'S0', evidence_ids: [], reactivation_record_id: null };
  const classification = classifyStage({
    evidence,
    scope: 'branch',
    branchId,
    dataConfidence: averageConfidence(branchEvidence),
  });
  return {
    branch_id: branchId,
    branch_name: name,
    current_stage: classification.current_stage,
    evidence_ids: classification.evidence_ids.sort(),
    reactivation_record_id: null,
  };
}

function averageConfidence(evidence: EvidenceNode[]): number {
  const values = evidence.map((item) => item.confidence).filter((item): item is number => typeof item === 'number');
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 45;
}

function confidenceBand(value: number): 'low' | 'medium' | 'high' {
  return value >= 75 ? 'high' : value >= 50 ? 'medium' : 'low';
}

function strongestBranch(branches: StageSnapshotTopic['branches']): string {
  const strongest = branches.reduce<StageSnapshotTopic['branches'][number] | null>((current, branch) => {
    if (!current) return branch;
    return stageRank[branch.current_stage as Stage] > stageRank[current.current_stage as Stage] ? branch : current;
  }, null);
  return strongest ? `${strongest.branch_name} (${strongest.current_stage})` : 'no independent branch';
}

function weakestScoreLayer(score: ScoreResult): string {
  return Object.entries(score.dimensions)
    .filter(([key]) => key !== 'data_confidence')
    .reduce<{ key: string; value: number } | null>((current, [key, detail]) => {
      if (!detail) return current;
      return !current || detail.score < current.value ? { key, value: detail.score } : current;
    }, null)?.key ?? 'unknown';
}

function missingLayers(stage: StageClassification): string[] {
  return stage.why_not_higher_stage === 'S6 is not safety; monitor continuity, friction, and S7 branch outcomes.'
    ? []
    : [stage.why_not_higher_stage];
}
