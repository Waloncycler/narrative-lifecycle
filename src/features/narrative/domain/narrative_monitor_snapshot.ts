import type { RegisteredNarrativeTopic } from '@/features/narrative/types/registered_topic';
import type { StageSnapshotHistory, StageSnapshotTopic } from '@/features/stages/types/diff';

/** Adds registry-only topics to the monitor without inventing stage evidence.
 * A branch remains a separate S0 record until it receives its own snapshot. */
export function mergeMonitorSnapshot(
  snapshot: StageSnapshotHistory | null,
  registeredTopics: RegisteredNarrativeTopic[],
): StageSnapshotHistory | null {
  if (!snapshot && !registeredTopics.length) return null;
  const existing = new Set(snapshot?.topics.map((topic) => topic.topic_id) ?? []);
  const missing = registeredTopics.filter((topic) => !existing.has(topic.topic_id)).map(registryOnlyTopic);
  if (snapshot) return { ...snapshot, topics: [...snapshot.topics, ...missing] };

  const generatedAt = registeredTopics.map((topic) => topic.updated_at).sort().at(-1) ?? new Date(0).toISOString();
  return {
    artifact_type: 'stage_snapshot_history',
    schema_version: '1.0.0',
    producer_version: 'database-read-model',
    rule_version: 'registry-only',
    snapshot_id: 'database_registry_snapshot',
    run_id: 'database_registry',
    generated_at: generatedAt,
    source_report_id: 'database_registry',
    topics: registeredTopics.map(registryOnlyTopic),
    early_radar_candidates: [],
    guardrail_check: {
      no_trading_advice: true,
      research_only_actions: true,
      parent_branch_separation_preserved: true,
      evidence_ids_visible: true,
      why_not_higher_present: true,
      data_confidence_present: true,
    },
  };
}

function registryOnlyTopic(topic: RegisteredNarrativeTopic): StageSnapshotTopic {
  const hasParentEvidence = topic.parent_evidence_ids.length > 0;
  return {
    topic_id: topic.topic_id,
    topic_name: topic.topic_name,
    parent_narrative: topic.topic_name,
    current_stage: topic.current_stage,
    gate_stage: hasParentEvidence && topic.current_stage !== 'S0' ? topic.current_stage : (hasParentEvidence ? 'S1' : 'S0'),
    max_allowed_stage: hasParentEvidence ? 'S7A' : 'S0',
    strongest_branch: topic.branches.length ? '分支尚未形成独立阶段快照' : '暂无已登记分支',
    weakest_layer: hasParentEvidence ? '阶段快照待重建' : '父主题基准证据',
    data_confidence: 'low',
    evidence_ids: topic.parent_evidence_ids,
    score_id: `registry_${topic.topic_id}`,
    dashboard_card_id: `registry_${topic.topic_id}`,
    why_not_higher_stage: hasParentEvidence
      ? '该主题尚未生成正式阶段快照；需运行标准阶段门槛流程后再确认当前阶段。'
      : '整体主题尚无正式父主题证据表；分支证据会单独展示，不能升级整体主题。',
    gate_why_not_higher_stage: hasParentEvidence
      ? '正式阶段快照尚未生成。'
      : '缺少可引用的整体主题基准证据。',
    gate_evidence_ids: topic.parent_evidence_ids,
    branches: topic.branches.map((branch) => ({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
      current_stage: 'S0',
      evidence_ids: branch.evidence_ids,
      reactivation_record_id: null,
    })),
  };
}
