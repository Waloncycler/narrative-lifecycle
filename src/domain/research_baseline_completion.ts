import type { StageSnapshotHistory } from '@/types/diff';
import type { TopicRegistry } from '@/types/topic_resolution';
import type { ResearchBaselineCompletionItem, ResearchBaselineCompletionReport } from '@/types/research_baseline_completion';
import { isUsableBranchName, marketBranchName, marketTopicName } from './market_naming';

const PARENT_BASELINE_LAYERS = ['name', 'capital', 'pricing', 'reality'] as const;

/** Translates known evidence/name gaps into research work. It deliberately
 * does not manufacture evidence, rewrite names, or calculate a lifecycle. */
export function buildResearchBaselineCompletion(input: {
  snapshot: StageSnapshotHistory | null;
  registry: TopicRegistry;
  generatedAt: string;
  producerVersion: string;
}): ResearchBaselineCompletionReport {
  const items: ResearchBaselineCompletionItem[] = [];
  const snapshotTopics = new Map(input.snapshot?.topics.map((topic) => [topic.topic_id, topic]) ?? []);

  for (const topic of input.registry.canonical_topics.filter((item) => item.status === 'active')) {
    const state = snapshotTopics.get(topic.topic_id);
    const name = marketTopicName(topic);
    if (state?.current_stage === 'S0' && state.evidence_ids.length === 0) {
      items.push({
        item_id: `baseline_parent_${topic.topic_id}`,
        kind: 'parent_evidence_baseline', priority: 'high', topic_id: topic.topic_id, branch_id: null,
        display_name_zh: name, required_layers: [...PARENT_BASELINE_LAYERS],
        rationale: '整体主题缺少正式父主题证据表；当前 S0 是阶段基准缺口，不是外部市场早期结论。',
        suggested_query: `${name} 官方 政策 监管 披露 验证 产能 订单 临床 试验`,
        next_action: 'research_original_sources', evidence_eligibility: 'context_only',
      });
    }
    if (topic.naming_status !== 'verified') {
      items.push({
        item_id: `name_topic_${topic.topic_id}`,
        kind: 'topic_name_verification', priority: state?.current_stage === 'S0' && state.evidence_ids.length === 0 ? 'high' : 'medium',
        topic_id: topic.topic_id, branch_id: null, display_name_zh: name, required_layers: ['name'],
        rationale: '主题中文名称尚未取得可追溯来源支持；不得把内部标签当作市场共识。',
        suggested_query: `${name} 官方 定义 政策 行业 报告`,
        next_action: 'validate_market_name', evidence_eligibility: 'context_only',
      });
    }
  }

  for (const branch of input.registry.branches.filter((item) => item.status !== 'archived')) {
    const topic = input.registry.canonical_topics.find((item) => item.topic_id === branch.topic_id);
    if (!topic) continue;
    const branchName = marketBranchName(branch);
    if (branch.naming_status === 'verified' && isUsableBranchName(branchName)) continue;
    items.push({
      item_id: `name_branch_${branch.branch_id}`,
      kind: 'branch_name_verification', priority: 'medium', topic_id: branch.topic_id, branch_id: branch.branch_id,
      display_name_zh: branchName === '待命名细分方向' ? marketTopicName(topic) : branchName,
      required_layers: ['name'],
      rationale: '细分方向缺少来源支持的市场名称；原始记录保留审计，但不会作为可展示分支或父主题证据。',
      suggested_query: `${marketTopicName(topic)} ${branchName === '待命名细分方向' ? '细分方向 官方 定义' : `${branchName} 官方 定义`}`,
      next_action: 'validate_market_name', evidence_eligibility: 'context_only',
    });
  }

  const ordered = items.sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority) || left.item_id.localeCompare(right.item_id));
  return {
    artifact_type: 'research_baseline_completion_report', schema_version: '1.0.0', producer_version: input.producerVersion,
    baseline_plan_id: `research_baseline_${input.generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
    generated_at: input.generatedAt, source_snapshot_id: input.snapshot?.snapshot_id ?? null, items: ordered,
    summary: {
      parent_evidence_baseline_count: ordered.filter((item) => item.kind === 'parent_evidence_baseline').length,
      topic_name_verification_count: ordered.filter((item) => item.kind === 'topic_name_verification').length,
      branch_name_verification_count: ordered.filter((item) => item.kind === 'branch_name_verification').length,
      high_priority_count: ordered.filter((item) => item.priority === 'high').length,
    },
    guardrail_check: { existing_stage_unchanged: true, no_auto_evidence_import: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_registry_name_mutation: true, no_trading_advice: true },
  };
}

function priorityRank(value: ResearchBaselineCompletionItem['priority']): number { return value === 'high' ? 0 : 1; }
