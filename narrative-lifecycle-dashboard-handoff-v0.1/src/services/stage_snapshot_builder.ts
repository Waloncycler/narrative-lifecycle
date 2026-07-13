import type { DataConfidenceBand, StageSnapshotHistory } from '../types/diff';
import type { RunContext } from '../types/run_context';
import { artifactMetadata } from '../types/artifact_contract';
import type { DiffArtifacts } from './diff_artifact_loader';

function confidenceBand(value: number): DataConfidenceBand {
  if (value >= 75) return 'high';
  if (value >= 50) return 'medium';
  return 'low';
}

export function buildStageSnapshot(artifacts: DiffArtifacts, context: RunContext): StageSnapshotHistory {
  const radarByTopic = new Map(artifacts.early_radar_candidates.map((candidate) => [candidate.candidate_name, candidate]));

  const topics = artifacts.dashboard_cards.map((card) => {
    const score = artifacts.scores.find((candidate) => candidate.topic_id === card.topic_id);
    if (!score) throw new Error(`Incomplete diff artifacts for topic: ${card.topic_id}`);
    const radar = radarByTopic.get(card.topic_name);
    const dimensions = Object.entries(score.dimensions).filter(([key]) => key !== 'data_confidence');
    const weakest = dimensions.reduce<[string, { score: number }] | undefined>((current, entry) => {
      const detail = entry[1];
      if (!current || detail.score < current[1].score) return [entry[0], detail];
      return current;
    }, undefined)?.[0] ?? 'unknown';
    const strongest = card.key_branches.reduce<typeof card.key_branches[number] | undefined>((current, branch) =>
      !current || branch.branch_coverage_score > current.branch_coverage_score ? branch : current, undefined);
    return {
      topic_id: card.topic_id,
      topic_name: card.topic_name,
      parent_narrative: card.parent_narrative,
      current_stage: card.current_stage,
      gate_stage: card.stage_snapshot.current_stage,
      max_allowed_stage: card.stage_snapshot.max_allowed_stage,
      strongest_branch: strongest ? `${strongest.branch_name} (${strongest.current_stage})` : 'no independent branch',
      weakest_layer: weakest,
      data_confidence: confidenceBand(card.data_confidence),
      evidence_ids: [...card.evidence_ids].sort(),
      score_id: score.score_id,
      dashboard_card_id: card.card_id,
      why_not_higher_stage: card.why_not_higher_stage,
      gate_why_not_higher_stage: card.stage_snapshot.why_not_higher_stage,
      gate_evidence_ids: [...card.stage_snapshot.evidence_ids].sort(),
      branches: card.key_branches.map((branch) => ({
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        current_stage: branch.current_stage,
        evidence_ids: [...branch.evidence_ids].sort(),
        reactivation_record_id: radar?.reactivation_record_id ?? null,
      })),
    };
  });

  return {
    ...artifactMetadata({
      artifact_type: 'stage_snapshot_history',
      rule_version: context.rule_version,
      run_id: context.run_id,
      generated_at: context.started_at,
    }),
    snapshot_id: `stage_snapshot_${context.run_id}`,
    run_id: context.run_id,
    generated_at: context.started_at,
    source_report_id: `weekly_brief_${context.run_id}`,
    topics,
    early_radar_candidates: artifacts.early_radar_candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      candidate_topic: candidate.candidate_name,
      reactivation_record_id: candidate.reactivation_record_id ?? '',
      evidence_ids: artifacts.dashboard_cards.find((card) => card.topic_name === candidate.candidate_name)?.evidence_ids ?? [],
    })),
    guardrail_check: {
      no_trading_advice: !/\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i.test(JSON.stringify(artifacts)),
      research_only_actions: artifacts.dashboard_cards.every((card) => ['observe', 'early research', 'focus tracking', 'wait for confirmation', 'validation tracking', 'overcrowding alert', 'failure watch'].includes(card.action)),
      parent_branch_separation_preserved: artifacts.dashboard_cards.every((card) => card.key_branches.every((branch) => branch.parent_lift_assessment.includes('cannot automatically upgrade'))),
      evidence_ids_visible: artifacts.dashboard_cards.every((card) => card.evidence_ids.length > 0),
      why_not_higher_present: artifacts.dashboard_cards.every((card) => card.why_not_higher_stage.length > 0),
      data_confidence_present: artifacts.dashboard_cards.every((card) => typeof card.data_confidence === 'number'),
    },
  };
}
