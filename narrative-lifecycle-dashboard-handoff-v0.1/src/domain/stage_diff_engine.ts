import type {
  GuardrailChange,
  RadarChange,
  StageDiff,
  StageSnapshotHistory,
  StageSnapshotTopic,
  TopicChange,
  TopicChangeType,
} from '../types/diff';
import { artifactMetadata } from '../types/artifact_contract';

const orderedStages = ['S0', 'S1', 'S2', 'S3', 'S4', 'S4-S5', 'S5', 'S5-S6', 'S6', 'S6-S7A', 'S7A'];
const stateStages = new Set(['S7B', 'S7C']);

function difference(current: string[], previous: string[]): string[] {
  const previousSet = new Set(previous);
  return current.filter((value) => !previousSet.has(value)).sort();
}

function stageChange(previous: string, current: string): TopicChangeType | null {
  if (previous === current) return null;
  if (stateStages.has(previous) || stateStages.has(current)) return 'stage_band_change';
  const previousIndex = orderedStages.indexOf(previous);
  const currentIndex = orderedStages.indexOf(current);
  if (previousIndex < 0 || currentIndex < 0) return 'stage_band_change';
  return currentIndex > previousIndex ? 'stage_upgrade' : 'stage_downgrade';
}

function sameBranches(previous: StageSnapshotTopic, current: StageSnapshotTopic): boolean {
  return JSON.stringify(previous.branches) === JSON.stringify(current.branches)
    && previous.strongest_branch === current.strongest_branch;
}

function branchMutation(current: StageSnapshotTopic, previous: StageSnapshotTopic): StageSnapshotTopic['branches'][number] | null {
  const previousIds = new Set(previous.branches.map((branch) => branch.branch_id));
  const newBranch = current.branches.find((branch) => !previousIds.has(branch.branch_id));
  if (newBranch) return newBranch;
  return current.branches.find((branch) =>
    branch.reactivation_record_id
    && branch.current_stage !== current.current_stage
    && (!previous.branches.find((old) => old.branch_id === branch.branch_id)?.reactivation_record_id),
  ) ?? null;
}

function choosePrimary(changes: TopicChangeType[]): TopicChangeType {
  const precedence: TopicChangeType[] = [
    'stage_downgrade', 'stage_upgrade', 'stage_band_change', 'branch_mutation_candidate',
    'evidence_changed', 'evidence_added', 'evidence_removed', 'why_not_higher_changed',
    'data_confidence_changed', 'branch_change', 'no_change',
  ];
  return precedence.find((type) => changes.includes(type)) ?? 'no_change';
}

function compareTopic(previous: StageSnapshotTopic, current: StageSnapshotTopic): TopicChange {
  const newEvidence = difference(current.evidence_ids, previous.evidence_ids);
  const removedEvidence = difference(previous.evidence_ids, current.evidence_ids);
  const changes: TopicChangeType[] = [];
  const stage = stageChange(previous.current_stage, current.current_stage);
  if (stage) changes.push(stage);
  if (newEvidence.length && removedEvidence.length) changes.push('evidence_changed');
  else if (newEvidence.length) changes.push('evidence_added');
  else if (removedEvidence.length) changes.push('evidence_removed');
  if (previous.why_not_higher_stage !== current.why_not_higher_stage) changes.push('why_not_higher_changed');
  if (previous.data_confidence !== current.data_confidence) changes.push('data_confidence_changed');
  if (!sameBranches(previous, current)) changes.push('branch_change');
  const mutation = branchMutation(current, previous);
  if (mutation) changes.push('branch_mutation_candidate');
  if (!changes.length) changes.push('no_change');

  const primary = choosePrimary(changes);
  const reasonParts = changes.map((change) => change.replaceAll('_', ' '));
  return {
    topic_id: current.topic_id,
    topic_name: current.topic_name,
    change_type: primary,
    detected_changes: changes,
    previous_stage: previous.current_stage,
    current_stage: current.current_stage,
    previous_evidence_ids: previous.evidence_ids,
    current_evidence_ids: current.evidence_ids,
    new_evidence_ids: newEvidence,
    removed_evidence_ids: removedEvidence,
    previous_why_not_higher_stage: previous.why_not_higher_stage,
    current_why_not_higher_stage: current.why_not_higher_stage,
    previous_data_confidence: previous.data_confidence,
    current_data_confidence: current.data_confidence,
    change_reason: `Detected: ${reasonParts.join(', ')}. Comparison uses persisted artifacts only.`,
    priority: primary === 'stage_downgrade' ? 'high' : primary === 'stage_upgrade' || primary === 'branch_mutation_candidate' ? 'medium' : 'low',
    research_only_action: primary === 'stage_downgrade' ? 'flag_risk' : primary === 'no_change' ? 'observe' : 'review',
    branch_id: mutation?.branch_id ?? null,
    reactivation_record_id: mutation?.reactivation_record_id ?? null,
  };
}

function initialTopic(current: StageSnapshotTopic): TopicChange {
  return {
    topic_id: current.topic_id,
    topic_name: current.topic_name,
    change_type: 'initial_snapshot',
    detected_changes: ['initial_snapshot'],
    previous_stage: null,
    current_stage: current.current_stage,
    previous_evidence_ids: [],
    current_evidence_ids: current.evidence_ids,
    new_evidence_ids: current.evidence_ids,
    removed_evidence_ids: [],
    previous_why_not_higher_stage: null,
    current_why_not_higher_stage: current.why_not_higher_stage,
    previous_data_confidence: null,
    current_data_confidence: current.data_confidence,
    change_reason: 'No previous snapshot found. Current run saved as baseline.',
    priority: 'low',
    research_only_action: 'observe',
    branch_id: null,
    reactivation_record_id: null,
  };
}

function compareRadar(previous: StageSnapshotHistory, current: StageSnapshotHistory): RadarChange[] {
  const oldIds = new Set(previous.early_radar_candidates.map((candidate) => candidate.candidate_id));
  const newIds = new Set(current.early_radar_candidates.map((candidate) => candidate.candidate_id));
  const added: RadarChange[] = current.early_radar_candidates
    .filter((candidate) => !oldIds.has(candidate.candidate_id))
    .map((candidate) => ({ ...candidate, change_type: 'early_radar_added', priority: 'medium', research_only_action: 'review' }));
  const removed: RadarChange[] = previous.early_radar_candidates
    .filter((candidate) => !newIds.has(candidate.candidate_id))
    .map((candidate) => ({ ...candidate, change_type: 'early_radar_removed', priority: 'medium', research_only_action: 'review' }));
  return [...added, ...removed];
}

function compareGuardrails(previous: StageSnapshotHistory, current: StageSnapshotHistory): GuardrailChange[] {
  return (Object.keys(current.guardrail_check) as Array<keyof typeof current.guardrail_check>)
    .filter((guardrail) => previous.guardrail_check[guardrail] === true && current.guardrail_check[guardrail] === false)
    .map((guardrail) => ({
      guardrail,
      change_type: 'guardrail_regression',
      previous_value: true,
      current_value: false,
      priority: 'high',
      research_only_action: 'flag_risk',
    }));
}

export function buildStageDiff(current: StageSnapshotHistory, previous: StageSnapshotHistory | null): StageDiff {
  const previousByTopic = new Map(previous?.topics.map((topic) => [topic.topic_id, topic]) ?? []);
  const topicChanges = current.topics.map((topic) => {
    const old = previousByTopic.get(topic.topic_id);
    return old ? compareTopic(old, topic) : initialTopic(topic);
  });
  const earlyRadarChanges = previous ? compareRadar(previous, current) : [];
  const guardrailChanges = previous ? compareGuardrails(previous, current) : [];
  const generatedAt = current.generated_at;
  const significant = topicChanges.filter((change) => change.change_type !== 'no_change' && change.change_type !== 'initial_snapshot');

  return {
    ...artifactMetadata({
      artifact_type: 'stage_diff',
      rule_version: current.rule_version,
      run_id: current.run_id,
      generated_at: generatedAt,
    }),
    diff_id: `stage_diff_${current.run_id}`,
    run_id: current.run_id,
    generated_at: generatedAt,
    status: previous ? 'ok' : 'no_previous_snapshot',
    previous_snapshot_id: previous?.snapshot_id ?? null,
    current_snapshot_id: current.snapshot_id,
    summary: {
      topic_count: topicChanges.length,
      stage_upgrade_count: topicChanges.filter((change) => change.detected_changes.includes('stage_upgrade')).length,
      stage_downgrade_count: topicChanges.filter((change) => change.detected_changes.includes('stage_downgrade')).length,
      evidence_added_count: topicChanges.filter((change) => change.detected_changes.includes('evidence_added') || change.detected_changes.includes('evidence_changed')).length,
      branch_mutation_candidate_count: topicChanges.filter((change) => change.detected_changes.includes('branch_mutation_candidate')).length,
      guardrail_regression_count: guardrailChanges.length,
    },
    topic_changes: topicChanges,
    early_radar_changes: earlyRadarChanges,
    guardrail_changes: guardrailChanges,
    next_operator_actions: [
      ...significant.map((change) => ({
      action: change.research_only_action,
      topic_id: change.topic_id,
      reason: change.change_reason,
      evidence_ids: change.new_evidence_ids.length ? change.new_evidence_ids : change.current_evidence_ids,
      })),
      ...earlyRadarChanges.map((change) => ({
        action: change.research_only_action,
        reason: `${change.change_type}: ${change.candidate_topic}; reactivation reference preserved.`,
        evidence_ids: change.evidence_ids,
      })),
      ...guardrailChanges.map((change) => ({
        action: change.research_only_action,
        reason: `Guardrail regression requires review: ${change.guardrail}.`,
        evidence_ids: [],
      })),
    ],
  };
}
