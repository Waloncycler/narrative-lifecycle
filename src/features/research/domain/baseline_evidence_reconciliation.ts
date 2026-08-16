import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type {
  BaselineEvidenceCandidate,
  BaselineEvidenceReconciliationItem,
  BaselineEvidenceReconciliationReport,
} from '@/features/research/types/baseline_evidence_reconciliation';

const MINIMUM_CONFIDENCE = 60;
const MINIMUM_INDEPENDENT_SOURCES = 2;
const ADMISSIBLE_SOURCE_TYPES = new Set(['official', 'regulatory', 'policy', 'filing', 'research', 'academic', 'company']);

export function buildBaselineEvidenceReconciliation(input: {
  registry: TopicRegistry;
  evidence: EvidenceNode[];
  admittedEvidenceIds: Set<string>;
  generatedAt: string;
  producerVersion: string;
}): BaselineEvidenceReconciliationReport {
  const activeTopics = input.registry.canonical_topics.filter((topic) => topic.status === 'active' || topic.status === 'provisional');
  const items = activeTopics.map((topic) => reconcileTopic({
    topicId: topic.topic_id,
    topicName: topic.market_name_zh || topic.topic_name,
    evidence: input.evidence.filter((item) => item.topic_id === topic.topic_id),
    admittedEvidenceIds: input.admittedEvidenceIds,
  }));
  const count = (status: BaselineEvidenceReconciliationItem['status']) => items.filter((item) => item.status === status).length;

  return {
    artifact_type: 'baseline_evidence_reconciliation_report',
    schema_version: '1.0.0',
    producer_version: input.producerVersion,
    report_id: `baseline_reconciliation_${input.generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
    generated_at: input.generatedAt,
    summary: {
      active_topic_count: activeTopics.length,
      already_admitted_count: count('already_admitted'),
      ready_for_review_count: count('ready_for_review'),
      insufficient_evidence_count: count('insufficient_evidence'),
      blocked_count: count('blocked'),
      eligible_parent_evidence_count: items.reduce((total, item) => total + item.eligible_parent_evidence.length, 0),
    },
    items,
    guardrail_check: {
      evidence_table_required: true,
      parent_branch_separation: true,
      no_automatic_admission: true,
      no_trading_advice: true,
    },
  };
}

function reconcileTopic(input: {
  topicId: string;
  topicName: string;
  evidence: EvidenceNode[];
  admittedEvidenceIds: Set<string>;
}): BaselineEvidenceReconciliationItem {
  const parentEvidence = input.evidence.filter((item) => item.parent_or_branch === 'parent' || !item.branch_id);
  const alreadyAdmitted = parentEvidence.filter((item) => input.admittedEvidenceIds.has(item.evidence_id));
  const eligible: BaselineEvidenceCandidate[] = [];
  const excluded: string[] = [];

  for (const item of parentEvidence) {
    if (input.admittedEvidenceIds.has(item.evidence_id)) continue;
    const candidate = toCandidate(item);
    if (candidate) eligible.push(candidate);
    else excluded.push(item.evidence_id);
  }

  const independentSourceCount = new Set(eligible.map((item) => item.source_host)).size;
  if (alreadyAdmitted.length) {
    return {
      topic_id: input.topicId,
      topic_name: input.topicName,
      status: 'already_admitted',
      eligible_parent_evidence: eligible,
      excluded_evidence_ids: excluded,
      independent_source_count: independentSourceCount,
      reasons: ['至少一条父主题证据已进入运营证据表；其余候选仍可在后续基线审核中补充。'],
    };
  }
  if (!parentEvidence.length) {
    return emptyItem(input, 'insufficient_evidence', '没有父主题证据；分支证据不会用于整体主题基线。');
  }
  if (!eligible.length) {
    return emptyItem(input, 'blocked', '父主题材料均未满足来源、日期、强度或置信度的基线要求。', excluded);
  }
  if (independentSourceCount < MINIMUM_INDEPENDENT_SOURCES) {
    return {
      topic_id: input.topicId,
      topic_name: input.topicName,
      status: 'insufficient_evidence',
      eligible_parent_evidence: eligible,
      excluded_evidence_ids: excluded,
      independent_source_count: independentSourceCount,
      reasons: [`可用父主题证据只覆盖 ${independentSourceCount} 个独立来源；基线准入至少需要 ${MINIMUM_INDEPENDENT_SOURCES} 个。`],
    };
  }
  return {
    topic_id: input.topicId,
    topic_name: input.topicName,
    status: 'ready_for_review',
    eligible_parent_evidence: eligible,
    excluded_evidence_ids: excluded,
    independent_source_count: independentSourceCount,
    reasons: ['已具备可审核的父主题基线证据；需由具名审核人执行准入，之后才会重算阶段。'],
  };
}

function emptyItem(
  input: { topicId: string; topicName: string },
  status: 'insufficient_evidence' | 'blocked',
  reason: string,
  excludedEvidenceIds: string[] = [],
): BaselineEvidenceReconciliationItem {
  return {
    topic_id: input.topicId,
    topic_name: input.topicName,
    status,
    eligible_parent_evidence: [],
    excluded_evidence_ids: excludedEvidenceIds,
    independent_source_count: 0,
    reasons: [reason],
  };
}

function toCandidate(item: EvidenceNode): BaselineEvidenceCandidate | null {
  if (!item.evidence_id || !item.event_title || !item.event_date || !item.source_url) return null;
  if (item.evidence_strength === 'E0' || item.evidence_strength === 'E1') return null;
  if ((item.confidence ?? 0) < MINIMUM_CONFIDENCE) return null;
  // Older controlled backfills used the canonical source class in
  // `source_name` before `source_type` became mandatory. Accept that exact,
  // finite vocabulary only; never infer a class from a hostname or title.
  const sourceType = item.source_type ?? item.source_name;
  if (!ADMISSIBLE_SOURCE_TYPES.has(sourceType)) return null;
  const eventDate = item.event_date;
  try {
    const sourceHost = new URL(item.source_url).hostname.toLowerCase();
    if (!sourceHost) return null;
    return {
      evidence_id: item.evidence_id,
      event_title: item.event_title,
      event_date: eventDate,
      source_url: item.source_url,
      source_host: sourceHost,
      evidence_strength: item.evidence_strength,
      confidence: item.confidence ?? 0,
    };
  } catch {
    return null;
  }
}
