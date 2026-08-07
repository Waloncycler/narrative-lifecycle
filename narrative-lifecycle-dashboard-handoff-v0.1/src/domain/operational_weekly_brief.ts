import type { EvidenceNode } from './evidence';
import { artifactMetadata } from '../types/artifact_contract';
import type { StageDiff, StageSnapshotHistory, StageSnapshotTopic } from '../types/diff';
import type { RunContext } from '../types/run_context';
import type { WeeklyBrief } from '../types/report';

/**
 * Builds the operator-facing brief from the formal operational Evidence Table.
 * Golden fixtures stay in their own regression pipeline; they are never merged
 * with a live research run.
 */
export function buildOperationalWeeklyBrief(input: {
  context: RunContext;
  snapshot: StageSnapshotHistory;
  diff: StageDiff;
  evidence: EvidenceNode[];
  artifacts: {
    source_artifacts: string[];
    artifact_index: string[];
  };
}): WeeklyBrief {
  const evidenceById = new Map(input.evidence.map((item) => [item.evidence_id, item]));
  const topicsWithEvidence = input.snapshot.topics.filter((topic) => topicEvidenceIds(topic).length > 0);
  const guardrails = input.snapshot.guardrail_check;

  return {
    ...artifactMetadata({
      artifact_type: 'weekly_brief',
      rule_version: input.context.rule_version,
      run_id: input.context.run_id,
      generated_at: input.context.started_at,
    }),
    report_id: `weekly_brief_${input.context.run_id}`,
    generated_at: input.context.started_at,
    source_artifacts: input.artifacts.source_artifacts,
    executive_summary: {
      dashboard_card_count: input.snapshot.topics.length,
      score_count: input.snapshot.topics.filter((topic) => topic.evidence_ids.length > 0).length,
      golden_case_passed: 0,
      golden_case_total: 0,
      early_radar_candidate_count: input.snapshot.early_radar_candidates.length,
      system_status: Object.values(guardrails).every(Boolean) ? 'ok' : 'review_required',
      rule_version: input.context.rule_version,
    },
    stage_snapshot: input.snapshot.topics.map((topic) => ({
      topic_id: topic.topic_id,
      topic_name: topic.topic_name,
      current_stage: topic.current_stage,
      parent_narrative: topic.parent_narrative,
      strongest_branch: topic.strongest_branch,
      weakest_layer: topic.weakest_layer,
      data_confidence: confidencePercent(topic.data_confidence),
    })),
    stage_change_summary: {
      previous_snapshot_id: input.diff.previous_snapshot_id,
      current_snapshot_id: input.diff.current_snapshot_id,
      upgrade_count: input.diff.summary.stage_upgrade_count,
      downgrade_count: input.diff.summary.stage_downgrade_count,
      evidence_added_count: input.diff.summary.evidence_added_count,
      branch_mutation_candidate_count: input.diff.summary.branch_mutation_candidate_count,
      guardrail_regression_count: input.diff.summary.guardrail_regression_count,
    },
    stage_changes: input.diff.topic_changes.map((change) => ({
      topic_id: change.topic_id,
      topic_name: change.topic_name,
      previous_stage: change.previous_stage,
      current_stage: change.current_stage,
      change_type: change.change_type,
      detected_changes: change.detected_changes,
      new_evidence_ids: change.new_evidence_ids,
      removed_evidence_ids: change.removed_evidence_ids,
      change_reason: change.change_reason,
      priority: change.priority,
      research_only_action: change.research_only_action,
      branch_id: change.branch_id,
      reactivation_record_id: change.reactivation_record_id,
    })),
    strongest_evidence: input.snapshot.topics.flatMap((topic) => topicEvidenceIds(topic)
      .map((id) => evidenceById.get(id))
      .filter((item): item is EvidenceNode => Boolean(item))
      .sort((a, b) => strengthRank(b.evidence_strength) - strengthRank(a.evidence_strength))
      .slice(0, 2)
      .map((item) => ({
        evidence_id: item.evidence_id,
        evidence_strength: item.evidence_strength,
        affected_layer: item.affected_layer,
        topic: topic.topic_name,
        interpretation: item.interpretation ?? item.event_summary ?? 'Formal evidence is recorded; the next validation target is shown in why_not_higher_stage.',
      }))),
    why_not_higher: topicsWithEvidence.map((topic) => ({
      topic_id: topic.topic_id,
      topic_name: topic.topic_name,
      current_stage: topic.current_stage,
      why_not_higher_stage: topic.why_not_higher_stage,
      evidence_ids: topicEvidenceIds(topic),
    })),
    early_radar_candidates: [],
    guardrail_check: guardrails,
    next_operator_actions: input.diff.next_operator_actions.length
      ? input.diff.next_operator_actions
      : topicsWithEvidence.map((topic) => ({
        action: 'validate' as const,
        topic_id: topic.topic_id,
        reason: topic.why_not_higher_stage,
        evidence_ids: topicEvidenceIds(topic),
      })),
    artifact_index: input.artifacts.artifact_index,
  };
}

function topicEvidenceIds(topic: StageSnapshotTopic): string[] {
  return [...new Set([
    ...topic.evidence_ids,
    ...topic.branches.flatMap((branch) => branch.evidence_ids),
  ])].sort();
}

function confidencePercent(value: 'low' | 'medium' | 'high'): number {
  return value === 'high' ? 85 : value === 'medium' ? 60 : 35;
}

function strengthRank(value: string): number {
  return ({ E4: 4, E3: 3, E2: 2, E1: 1, E0: 0 } as Record<string, number>)[value] ?? 0;
}
