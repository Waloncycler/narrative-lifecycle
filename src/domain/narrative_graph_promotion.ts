import { evidenceStrengthRank, type EvidenceNode } from './evidence';
import type { AutonomousResearchPolicy } from '@/types/autonomous_research';
import type { TopicRegistry } from '@/types/topic_resolution';
import type { NarrativeGraphPromotionItem, NarrativeGraphPromotionReport } from '@/types/narrative_graph_promotion';
import { hasVerifiedMarketName } from './market_naming';

const confidenceMinimum = { low: 0, medium: 50, high: 75 } as const;
const forbiddenText = /\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i;

/**
 * Determines whether a newly discovered node has accumulated enough
 * independently sourced, formal evidence to become visible as active.
 *
 * This is a registry decision only. It does not classify a Stage, calculate a
 * score, or turn branch evidence into parent evidence.
 */
export function evaluateNarrativeGraphPromotions(input: {
  registry: TopicRegistry;
  evidence: EvidenceNode[];
  policy: AutonomousResearchPolicy;
  runId: string;
  generatedAt: string;
  producerVersion?: string;
}): NarrativeGraphPromotionReport {
  const items: NarrativeGraphPromotionItem[] = [];
  const provisionalIds = new Set(input.registry.provisional_topics
    .filter((item) => item.status === 'provisional')
    .map((item) => item.provisional_topic_id));

  for (const topic of input.registry.canonical_topics) {
    if (topic.status !== 'provisional' || !provisionalIds.has(topic.topic_id)) continue;
    const supporting = eligibleEvidence(input.evidence.filter((item) =>
      item.topic_id === topic.topic_id
      && (!input.policy.require_parent_evidence_for_topic_activation || item.parent_or_branch === 'parent'),
    ), input.policy);
    items.push(evaluateItem({
      nodeKind: 'topic',
      nodeId: topic.topic_id,
      parentTopicId: topic.topic_id,
      previousStatus: 'provisional',
      supporting,
      enabled: input.policy.enabled && input.policy.auto_promote_provisional_topics,
      threshold: input.policy.minimum_independent_sources_for_topic_activation,
      requireParentEvidence: input.policy.require_parent_evidence_for_topic_activation,
      verifiedMarketName: hasVerifiedMarketName(topic),
      policy: input.policy,
    }));
  }

  for (const branch of input.registry.branches) {
    if (branch.status !== 'watch') continue;
    const supporting = eligibleEvidence(input.evidence.filter((item) =>
      item.topic_id === branch.topic_id
      && item.parent_or_branch === 'branch'
      && item.branch_id === branch.branch_id,
    ), input.policy);
    items.push(evaluateItem({
      nodeKind: 'branch',
      nodeId: branch.branch_id,
      parentTopicId: branch.topic_id,
      previousStatus: 'watch',
      supporting,
      enabled: input.policy.enabled && input.policy.auto_activate_watch_branches,
      threshold: input.policy.minimum_independent_sources_for_branch_activation,
      requireParentEvidence: false,
      verifiedMarketName: hasVerifiedMarketName(branch),
      policy: input.policy,
    }));
  }

  return {
    artifact_type: 'narrative_graph_promotion_report',
    schema_version: '1.0.0',
    producer_version: input.producerVersion ?? 'v0.11.0',
    report_id: `narrative_graph_promotion_${input.runId}`,
    run_id: input.runId,
    generated_at: input.generatedAt,
    policy_id: input.policy.policy_id,
    items,
    summary: {
      provisional_topics_activated: items.filter((item) => item.node_kind === 'topic' && item.decision === 'activated').length,
      watch_branches_activated: items.filter((item) => item.node_kind === 'branch' && item.decision === 'activated').length,
      held_count: items.filter((item) => item.decision === 'held').length,
    },
    guardrail_check: {
      evidence_table_required: true,
      stage_first_score_second: true,
      parent_branch_separation: true,
      no_model_stage_or_score_control: true,
      no_trading_advice: true,
    },
  };
}

function evaluateItem(input: {
  nodeKind: 'topic' | 'branch';
  nodeId: string;
  parentTopicId: string;
  previousStatus: 'provisional' | 'watch';
  supporting: EvidenceNode[];
  enabled: boolean;
  threshold: number;
  requireParentEvidence: boolean;
  verifiedMarketName: boolean;
  policy: AutonomousResearchPolicy;
}): NarrativeGraphPromotionItem {
  const sources = independentSources(input.supporting);
  const reasons: string[] = [];
  if (!input.enabled) reasons.push('automatic graph promotion is disabled by policy');
  if (sources.size < input.threshold) reasons.push(`requires ${input.threshold} independent eligible sources; found ${sources.size}`);
  if (input.policy.hold_conflicting_evidence && input.supporting.some(isConflicting)) reasons.push('conflicting or negative formal evidence requires a hold');
  if (!input.verifiedMarketName) reasons.push('source-backed Chinese market name is required before automatic activation');
  if (input.supporting.some((item) => forbiddenText.test(JSON.stringify(item)))) reasons.push('trading language is prohibited');
  if (input.nodeKind === 'topic' && input.requireParentEvidence && !input.supporting.length) reasons.push('parent-scope formal evidence is required; branch evidence cannot activate the parent topic');
  const decision = reasons.length ? 'held' : 'activated';
  return {
    node_kind: input.nodeKind,
    node_id: input.nodeId,
    parent_topic_id: input.parentTopicId,
    previous_status: input.previousStatus,
    next_status: decision === 'activated' ? 'active' : null,
    decision,
    supporting_evidence_ids: input.supporting.map((item) => item.evidence_id).sort(),
    independent_source_count: sources.size,
    reasons: decision === 'activated'
      ? [`${sources.size} independent eligible formal sources satisfied the automatic promotion policy.`]
      : reasons,
    guardrail_check: {
      evidence_table_only: true,
      parent_evidence_required: input.requireParentEvidence,
      branch_does_not_upgrade_parent: true,
      conflict_checked: true,
      no_trading_advice: true,
    },
  };
}

function eligibleEvidence(rows: EvidenceNode[], policy: AutonomousResearchPolicy): EvidenceNode[] {
  return rows.filter((item) =>
    Boolean(item.source_url)
    && Boolean(item.source_type)
    && policy.permitted_source_types.includes(item.source_type as AutonomousResearchPolicy['permitted_source_types'][number])
    && (policy.allow_news_auto_publish || item.source_type !== 'news')
    && evidenceStrengthRank[item.evidence_strength] >= evidenceStrengthRank[policy.minimum_evidence_strength]
    && (item.confidence ?? 0) >= confidenceMinimum[policy.minimum_confidence],
  );
}

function independentSources(rows: EvidenceNode[]): Set<string> {
  return new Set(rows.map((item) => item.source_url?.trim()).filter((value): value is string => Boolean(value)));
}

function isConflicting(item: EvidenceNode): boolean {
  return item.positive_or_negative === 'negative' || item.stage_effect === 'downgrade';
}
