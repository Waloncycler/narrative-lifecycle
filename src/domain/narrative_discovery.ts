import { inferTopic, noTradingAdvice } from './intake_rules';
import type { EvidenceCandidate, EvidenceIntakeSession } from '../types/intake';
import type { TopicRegistry } from '../types/topic_resolution';
import type { NarrativeDiscoveryRecord, NarrativeDiscoveryReport, NarrativeDiscoveryResolution } from '../types/narrative_discovery';
import { marketBranchName, marketTopicName } from './market_naming';

const GENERIC_LABELS = new Set([
  'application', 'applications', 'market', 'markets', 'industry', 'industries', 'development', 'research', 'technology',
  'direction', 'opportunity', 'opportunities', 'business', 'services', 'service', 'product', 'products', 'solution', 'solutions',
  '领域', '场景', '应用', '行业', '产业', '市场', '发展', '技术', '方向', '业务', '服务', '产品', '项目', '相关', '主要',
  '范围广泛', '广泛', '范围', '多种', '多个', '不同', '其中', '包括', '覆盖', '有关', '部分',
]);

const BRANCH_SIGNAL = /\b(branch|sub[- ]?topic|sub[- ]?theme|application|use case|indication|therapy|diagnos(?:is|tic)|rehabilitation|logistics|manufacturing|infrastructure|supply chain|vertical|segment|modality|oncology|obesity|infection|metabolic|immune|neurology)\b|分支|细分|场景|适应症|治疗|诊断|康复|物流|制造|基础设施|供应链|应用|方向|领域/u;
const REACTIVATION_SIGNAL = /\b(reactivation|revival|old theme|returns?|again)\b|重新活跃|重启|再度|再次|回归|旧主题/u;
// These are source-text identifiers, not inferred entities. They cover drug
// candidates such as RC148 / HS-10535 and common international nonproprietary
// name suffixes. The same branch mechanism also works for product SKUs or
// technical assets in other industries.
const ASSET_IDENTIFIER = /\b(?:[A-Z]{2,10}-\d{2,8}|[A-Z]{1,6}\d{2,8}|[a-z][a-z-]{3,40}(?:mab|nib|tinib|citinib|vir|stat|parib|cept))\b/g;
const GENERATED_LABEL = /(?:对话窗口|研究发布方案|轻量智造还|持续扩张需求|^branch\s+[a-z0-9]+$|^unknown(?:_topic)?$|^unresolved$)/iu;

export function discoverNarrativeGraph(input: {
  session: EvidenceIntakeSession;
  registry: TopicRegistry;
  priorRecords: NarrativeDiscoveryRecord[];
  generatedAt: string;
  producerVersion?: string;
}): NarrativeDiscoveryReport {
  const discovered = input.session.candidates.map((candidate) => discoverCandidate(candidate, input.registry));
  const grouped = groupCandidates(discovered, input.priorRecords);
  const records = grouped.map((group) => recordFromGroup(group, input));
  const summary = {
    existing_branch_count: records.filter((record) => record.resolution === 'existing_branch').length,
    new_branch_count: records.filter((record) => record.resolution === 'new_branch').length,
    provisional_topic_count: records.filter((record) => record.resolution === 'new_provisional_topic').length,
    reactivation_count: records.filter((record) => record.resolution === 'reactivation').length,
    unresolved_count: records.filter((record) => record.resolution === 'unresolved').length,
  };
  return {
    artifact_type: 'narrative_discovery_report',
    schema_version: '1.0.0',
    producer_version: input.producerVersion ?? 'v0.10.0',
    report_id: `narrative_discovery_${safeId(input.session.session_id)}_${compactTimestamp(input.generatedAt)}`,
    generated_at: input.generatedAt,
    session_id: input.session.session_id,
    records,
    summary,
    guardrail_check: {
      source_quotes_present: records.every((record) => record.guardrail_check.source_quotes_present),
      no_forced_mapping: records.every((record) => record.resolution !== 'unresolved' || record.topic_id === null),
      parent_stage_unchanged: true,
      branch_evidence_isolated: records.every((record) => record.guardrail_check.branch_evidence_isolated),
      provisional_does_not_inherit_stage: records.every((record) => record.guardrail_check.provisional_does_not_inherit_stage),
      no_trading_advice: records.every((record) => record.guardrail_check.no_trading_advice),
    },
  };
}

/**
 * Applies only graph metadata. A branch is converted to `split_branch` evidence
 * with an explicit parent-isolation limitation; this function never produces a
 * Stage, Score, or parent-scope update.
 */
export function applyNarrativeDiscoveryMappings(session: EvidenceIntakeSession, report: NarrativeDiscoveryReport): EvidenceIntakeSession {
  const byCandidate = new Map<string, NarrativeDiscoveryRecord>();
  for (const record of report.records) {
    if (!record.topic_id || !record.branch_id || record.scope !== 'branch') continue;
    for (const ref of record.evidence_refs) byCandidate.set(ref.candidate_id, record);
  }
  return {
    ...session,
    candidates: session.candidates.map((candidate) => {
      const record = byCandidate.get(candidate.candidate_id);
      if (!record || !record.topic_id || !record.branch_id) return candidate;
      return {
        ...candidate,
        suggested_reason: `${candidate.suggested_reason} Narrative discovery: ${record.reason}`,
        uncertainty_notes: unique([
          ...candidate.uncertainty_notes,
          ...record.uncertainty_notes,
          'Discovered branch remains separate from the parent narrative.',
        ]),
        suggested_evidence: {
          ...candidate.suggested_evidence,
          topic_id: record.topic_id,
          branch_id: record.branch_id,
          scope: 'branch',
          stage_effect: 'split_branch',
          limitation: appendParentIsolation(candidate.suggested_evidence.limitation),
        },
      };
    }),
  };
}

interface CandidateDiscovery {
  candidate: EvidenceCandidate;
  resolution: NarrativeDiscoveryResolution;
  topicId: string | null;
  topicName: string | null;
  branchId: string | null;
  branchName: string | null;
  scope: 'parent' | 'branch' | null;
  parentScore: number;
  noveltyScore: number;
  reason: string;
  uncertainty: string[];
}

function discoverCandidate(candidate: EvidenceCandidate, registry: TopicRegistry): CandidateDiscovery {
  const text = `${candidate.original_quote}\n${candidate.suggested_evidence.event_title}\n${candidate.suggested_evidence.event_summary}`;
  const parent = findParent(candidate, text, registry);
  const branch = findBranch(candidate, text, parent.topicId, registry);
  const hasQuote = candidate.original_quote.trim().length > 0;

  if (parent.topicId && registry.memory_topic_ids.includes(parent.topicId) && REACTIVATION_SIGNAL.test(text)) {
    return {
      candidate, resolution: 'reactivation', topicId: parent.topicId, topicName: parent.topicName, branchId: branch.existingId, branchName: branch.name,
      scope: branch.name ? 'branch' : 'parent', parentScore: parent.score, noveltyScore: branch.novelty, reason: `Narrative Memory matched ${parent.topicId}; reactivation must be reviewed before treating it as new.`, uncertainty: ['Historical-theme reactivation requires a separate memory audit.'],
    };
  }

  if (parent.isProvisional) {
    return {
      candidate, resolution: 'new_provisional_topic', topicId: parent.topicId, topicName: parent.topicName, branchId: branch.id, branchName: branch.name,
      scope: branch.name ? 'branch' : 'parent', parentScore: parent.score, noveltyScore: branch.novelty, reason: `Provisional topic ${parent.topicId} is retained at S0; any branch stays watch-only.`, uncertainty: ['Provisional topics and their branches cannot inherit a stage.'],
    };
  }

  if (!parent.topicId) {
    return {
      candidate, resolution: 'unresolved', topicId: null, topicName: null, branchId: null, branchName: null, scope: null,
      parentScore: 0, noveltyScore: 0, reason: 'No canonical parent topic or source-grounded hierarchy relation was found; leave the material unresolved.', uncertainty: ['A researcher or a later model-backed pass must supply a grounded parent concept.'],
    };
  }

  if (branch.existingId) {
    return {
      candidate, resolution: 'existing_branch', topicId: parent.topicId, topicName: parent.topicName, branchId: branch.existingId, branchName: branch.name,
      scope: 'branch', parentScore: parent.score, noveltyScore: branch.novelty, reason: `Matched existing branch ${branch.existingId} under ${parent.topicId}.`, uncertainty: [],
    };
  }

  if (branch.id && branch.name && branch.strong && hasQuote) {
    return {
      candidate, resolution: 'new_branch', topicId: parent.topicId, topicName: parent.topicName, branchId: branch.id, branchName: branch.name,
      scope: 'branch', parentScore: parent.score, noveltyScore: branch.novelty, reason: `A source-grounded, distinct subtopic was found under ${parent.topicId}; register only as a watch branch.`, uncertainty: ['Watch branch requires further independent formal evidence before policy-based activation.'],
    };
  }

  return {
    candidate, resolution: 'unresolved', topicId: null, topicName: null, branchId: null, branchName: null, scope: null,
    parentScore: parent.score, noveltyScore: 0, reason: `Parent ${parent.topicId} was recognized, but the text does not contain a sufficiently specific branch relation.`, uncertainty: ['Do not create a branch from a broad parent-level statement.'],
  };
}

function findParent(candidate: EvidenceCandidate, text: string, registry: TopicRegistry): { topicId: string | null; topicName: string | null; score: number; isProvisional: boolean } {
  const requested = candidate.suggested_evidence.topic_id;
  const exact = registry.canonical_topics.find((topic) => topic.topic_id === requested);
  if (exact) return { topicId: exact.topic_id, topicName: marketTopicName(exact), score: 1, isProvisional: exact.status === 'provisional' };
  if (requested.startsWith('provisional_')) return { topicId: requested, topicName: humanize(requested), score: 0.92, isProvisional: true };

  const inferred = inferTopic(text.toLowerCase());
  const inferredTopic = registry.canonical_topics.find((topic) => topic.topic_id === inferred.topic_id);
  if (inferredTopic) return { topicId: inferredTopic.topic_id, topicName: marketTopicName(inferredTopic), score: 0.86, isProvisional: inferredTopic.status === 'provisional' };

  const normalized = normalize(text);
  const alias = registry.aliases.find((item) => includesPhrase(normalized, item.alias));
  if (alias) {
    const topic = registry.canonical_topics.find((item) => item.topic_id === alias.topic_id);
    if (topic) return { topicId: topic.topic_id, topicName: marketTopicName(topic), score: 0.9, isProvisional: topic.status === 'provisional' };
  }

  // The provider contract permits a concise new snake_case topic without the
  // provisional_ prefix. Normalize that shape here rather than discarding a
  // cited, structured discovery as unresolved. Registry promotion remains a
  // separate S0-only operation in Topic Resolver.
  if (requested && requested !== 'unknown_topic' && isSpecificTopicId(requested)) {
    const provisionalId = `provisional_${safeId(requested)}`;
    return { topicId: provisionalId, topicName: humanize(provisionalId), score: 0.7, isProvisional: true };
  }

  const matches = registry.canonical_topics
    .map((topic) => ({ topic, score: parentSimilarity(text, topic.topic_id, marketTopicName(topic), registry.aliases.filter((aliasItem) => aliasItem.topic_id === topic.topic_id).map((item) => item.alias)) }))
    .filter((item) => item.score >= 0.58)
    .sort((left, right) => right.score - left.score);
  const best = matches[0];
  return best
    ? { topicId: best.topic.topic_id, topicName: marketTopicName(best.topic), score: best.score, isProvisional: best.topic.status === 'provisional' }
    : { topicId: null, topicName: null, score: 0, isProvisional: false };
}

function findBranch(candidate: EvidenceCandidate, text: string, topicId: string | null, registry: TopicRegistry): { id: string | null; existingId: string | null; name: string | null; novelty: number; strong: boolean } {
  if (!topicId) return { id: null, existingId: null, name: null, novelty: 0, strong: false };
  const branches = registry.branches.filter((branch) => branch.topic_id === topicId);
  const explicit = candidate.suggested_evidence.branch_id;
  if (explicit) {
    const existing = branches.find((branch) => branch.branch_id === explicit);
    if (existing) return { id: existing.branch_id, existingId: existing.branch_id, name: marketBranchName(existing), novelty: 0, strong: true };
  }

  const asset = explicit ? null : extractAssetLabel(text);
  const extracted = explicit
    ? humanize(explicit.replace(new RegExp(`^${escapeRegExp(topicId)}_`), ''))
    : asset ?? extractBranchLabel(text, topicId, registry);
  if (!extracted || (!asset && !isSpecificLabel(extracted))) return { id: null, existingId: null, name: null, novelty: 0, strong: false };

  const similar = branches
    .map((branch) => ({ branch, score: labelSimilarity(extracted, marketBranchName(branch)) }))
    .sort((left, right) => right.score - left.score)[0];
  if (similar && similar.score >= 0.72) {
    return { id: similar.branch.branch_id, existingId: similar.branch.branch_id, name: marketBranchName(similar.branch), novelty: 0, strong: true };
  }
  const id = explicit && /^[a-z0-9_]{3,80}$/.test(explicit) ? explicit : branchId(topicId, extracted);
  return {
    id,
    existingId: null,
    name: extracted,
    novelty: Math.max(0.01, 1 - (similar?.score ?? 0)),
    strong: Boolean(asset) || BRANCH_SIGNAL.test(text) || Boolean(explicit),
  };
}

/** A named asset gets a watch branch so its evidence can accumulate safely. */
function extractAssetLabel(text: string): string | null {
  const matches = [...text.matchAll(ASSET_IDENTIFIER)]
    .map((match) => match[0])
    .filter((value) => value.length >= 4)
    .filter((value) => !['E0', 'E1', 'E2', 'E3', 'E4'].includes(value.toUpperCase()));
  return matches[0] ?? null;
}

function groupCandidates(items: CandidateDiscovery[], priorRecords: NarrativeDiscoveryRecord[]): Array<{ item: CandidateDiscovery; members: CandidateDiscovery[]; supportCount: number; independentDocumentCount: number }> {
  const grouped = new Map<string, CandidateDiscovery[]>();
  for (const item of items) {
    const key = `${item.resolution}:${item.topicId ?? 'none'}:${item.branchId ?? item.candidate.suggested_evidence.topic_id}`;
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }
  return [...grouped.values()].map((members) => {
    const item = members[0];
    // A branch is new only once. On a later document it resolves as an
    // existing branch, but it must retain the prior discovery support rather
    // than reset its evidence history because the resolution label changed.
    const prior = priorRecords.filter((record) => record.topic_id === item.topicId && record.branch_id === item.branchId);
    const documents = new Set([
      ...members.map((member) => member.candidate.raw_document_id),
      ...prior.flatMap((record) => record.evidence_refs.map((ref) => ref.raw_document_id)),
    ]);
    return { item, members, supportCount: documents.size, independentDocumentCount: documents.size };
  });
}

function recordFromGroup(group: { item: CandidateDiscovery; members: CandidateDiscovery[]; supportCount: number; independentDocumentCount: number }, input: { registry: TopicRegistry; generatedAt: string }): NarrativeDiscoveryRecord {
  const { item, members } = group;
  const scope = item.scope;
  const hasQuote = members.every((member) => member.candidate.original_quote.trim().length > 0);
  const isBranch = scope === 'branch';
  const confidence = item.resolution === 'unresolved' ? 'low' : item.parentScore >= 0.9 && hasQuote ? 'high' : 'medium';
  const registrationAction = item.resolution === 'new_branch'
    ? 'watch_branch'
    : item.resolution === 'new_provisional_topic'
      ? item.scope === 'branch' && item.branchId ? 'provisional_topic_and_watch_branch' : 'provisional_topic'
      : 'none';
  return {
    discovery_id: `discovery_${safeId(item.topicId ?? 'unresolved')}_${safeId(item.branchId ?? members[0].candidate.candidate_id)}`,
    resolution: item.resolution,
    topic_id: item.topicId,
    topic_name: item.topicName,
    branch_id: item.branchId,
    branch_name: item.branchName,
    scope,
    confidence,
    parent_match_score: round(item.parentScore),
    branch_novelty_score: round(item.noveltyScore),
    support_count: group.supportCount,
    independent_document_count: group.independentDocumentCount,
    registration_action: registrationAction,
    reason: item.reason,
    uncertainty_notes: unique(members.flatMap((member) => member.uncertainty)),
    evidence_refs: members.map((member) => ({
      candidate_id: member.candidate.candidate_id,
      raw_document_id: member.candidate.raw_document_id,
      provenance_id: member.candidate.provenance_id,
      quote: member.candidate.original_quote,
    })),
    audit_required: true,
    guardrail_check: {
      source_quotes_present: hasQuote,
      duplicate_checked: true,
      narrative_memory_checked: true,
      parent_stage_unchanged: true,
      branch_evidence_isolated: !isBranch || members.every((member) => member.candidate.suggested_evidence.scope !== 'parent' || item.resolution !== 'existing_branch'),
      provisional_does_not_inherit_stage: item.resolution !== 'new_provisional_topic' || item.topicId?.startsWith('provisional_') === true,
      no_trading_advice: members.every((member) => noTradingAdvice(member.candidate)),
    },
  };
}

function extractBranchLabel(text: string, topicId: string, registry: TopicRegistry): string | null {
  const candidates: string[] = [];
  for (const match of text.matchAll(/([A-Za-z][A-Za-z0-9 -]{1,52}?)\s+(?:applications?|therapy|therapies|diagnostics?|rehabilitation|logistics|manufacturing|infrastructure|supply chain|vertical|segment|indications?)/gi)) {
    candidates.push(match[0]);
  }
  for (const match of text.matchAll(/(?:在|用于|面向|针对|涉及|涵盖|聚焦|覆盖|服务于)([\u4e00-\u9fffA-Za-z0-9-]{2,18}?)(?=场景|领域|应用|适应症|治疗|诊断|方向|业务|行业|药物|[，。；])/g)) {
    candidates.push(match[1]);
  }
  for (const match of text.matchAll(/(?:[，。；、]|在|用于|面向|针对)([\u4e00-\u9fff]{2,14}(?:药物|疗法|治疗|诊断|康复|物流|制造|基础设施|供应链|应用|服务))/g)) {
    candidates.push(match[1]);
  }
  const parentAnchors = [
    topicId,
    ...registry.canonical_topics
      .filter((topic) => topic.topic_id === topicId)
      .flatMap((topic) => [marketTopicName(topic), topic.market_name_en])
      .filter((value): value is string => Boolean(value?.trim())),
    ...registry.aliases.filter((alias) => alias.topic_id === topicId).map((alias) => alias.alias),
  ];
  return candidates
    .map((value) => cleanLabel(value, parentAnchors))
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => labelQuality(right) - labelQuality(left))[0] ?? null;
}

function cleanLabel(value: string, parentAnchors: string[]): string | null {
  let cleaned = value.trim().replace(/\s+/g, ' ');
  for (const anchor of parentAnchors) cleaned = cleaned.replace(new RegExp(escapeRegExp(anchor), 'ig'), ' ');
  cleaned = cleaned
    .replace(/\b(the|a|an|for|in|and|with|completed|reported|validation|customer|pilot)\b/gi, ' ')
    .replace(/^(?:这一|该|本|其)/u, '')
    .replace(/(?:场景|领域|应用|适应症|方向|业务|行业)$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  return isSpecificLabel(cleaned) ? cleaned : null;
}

function isSpecificLabel(value: string): boolean {
  const normalized = normalize(value);
  if (!normalized || GENERATED_LABEL.test(value) || GENERIC_LABELS.has(normalized)) return false;
  if (['范围', '广泛', '相关', '不同', '多个', '多种', '其中', '包括', '覆盖', '部分'].some((term) => normalized.includes(term))) return false;
  const englishTokens = normalized.match(/[a-z0-9]+/g) ?? [];
  const chineseChars = normalized.match(/[\u4e00-\u9fff]/g) ?? [];
  if (englishTokens.length >= 2 && englishTokens.some((token) => !GENERIC_LABELS.has(token))) return true;
  return chineseChars.length >= 2 && ![...GENERIC_LABELS].includes(normalized);
}

function isSpecificTopicId(value: string): boolean {
  const normalized = safeId(value);
  return normalized.length >= 4 && !GENERIC_LABELS.has(normalized) && normalized !== 'unknown';
}

function labelQuality(value: string): number {
  const normalized = normalize(value);
  return Math.min(30, normalized.length) + (BRANCH_SIGNAL.test(value) ? 20 : 0);
}

function parentSimilarity(text: string, topicId: string, topicName: string, aliases: string[]): number {
  const normalized = normalize(text);
  const anchors = [topicId, topicName, ...aliases].map((value) => normalize(value)).filter(Boolean);
  if (anchors.some((anchor) => normalized.includes(anchor))) return 0.8;
  const source = tokens(normalized);
  const scores = anchors.map((anchor) => jaccard(source, tokens(anchor)));
  return Math.max(0, ...scores);
}

function labelSimilarity(left: string, right: string): number {
  const leftTokens = tokens(normalize(left));
  const rightTokens = tokens(normalize(right));
  const tokenScore = jaccard(leftTokens, rightTokens);
  const leftChars = new Set([...normalize(left)].filter((char) => /[\u4e00-\u9fff]/u.test(char)));
  const rightChars = new Set([...normalize(right)].filter((char) => /[\u4e00-\u9fff]/u.test(char)));
  return Math.max(tokenScore, jaccard(leftChars, rightChars));
}

function tokens(value: string): Set<string> {
  const result = new Set(value.match(/[a-z0-9]{2,}|[\u4e00-\u9fff]{2,}/g) ?? []);
  for (const token of [...result]) if (GENERIC_LABELS.has(token)) result.delete(token);
  return result;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function branchId(topicId: string, label: string): string {
  const ascii = normalize(label).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return ascii ? `${topicId}_${ascii}`.slice(0, 80) : `${topicId}_branch_${shortHash(label)}`;
}

function appendParentIsolation(limitation: string): string {
  const rule = 'Branch evidence cannot upgrade the parent narrative by itself.';
  return limitation.includes('cannot upgrade the parent') ? limitation : `${limitation} ${rule}`.trim();
}

function includesPhrase(text: string, phrase: string): boolean { return text.includes(normalize(phrase)); }
function normalize(value: string): string { return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim(); }
function humanize(value: string): string { return value.replace(/^provisional_/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
function safeId(value: string): string { return normalize(value).replace(/\s+/g, '_').slice(0, 64) || 'unknown'; }
function compactTimestamp(value: string): string { return value.replace(/[-:.TZ]/g, '').slice(0, 17); }
function unique(values: string[]): string[] { return [...new Set(values)]; }
function round(value: number): number { return Math.round(value * 100) / 100; }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function shortHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36).slice(0, 8);
}
