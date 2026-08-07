import type { EvidenceCandidate } from '../types/intake';
import type { TopicRegistry, TopicResolution, TopicResolutionAudit, TopicRegistryValidationReport } from '../types/topic_resolution';
import { inferTopic } from './intake_rules';
import { marketNameWarning } from './market_naming';

export function validateTopicRegistry(input: {
  registry: TopicRegistry;
  generatedAt: string;
  unresolvedCount?: number;
}): TopicRegistryValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const topicIds = new Set(input.registry.canonical_topics.map((topic) => topic.topic_id));
  const aliasKeys = new Set<string>();
  const branchIds = new Set<string>();

  for (const topic of input.registry.canonical_topics) {
    if (topic.status === 'provisional' && topic.current_stage !== 'S0') {
      errors.push(`${topic.topic_id}: provisional canonical topics must stay at S0`);
    }
    const namingWarning = marketNameWarning(topic);
    if (namingWarning) warnings.push(`${topic.topic_id}: ${namingWarning}`);
  }
  for (const alias of input.registry.aliases) {
    const key = normalize(alias.alias);
    if (aliasKeys.has(key)) errors.push(`${alias.alias}: duplicate alias`);
    aliasKeys.add(key);
    if (!topicIds.has(alias.topic_id)) errors.push(`${alias.alias}: alias target topic does not exist`);
  }
  for (const branch of input.registry.branches) {
    if (branchIds.has(branch.branch_id)) errors.push(`${branch.branch_id}: duplicate branch id`);
    branchIds.add(branch.branch_id);
    if (!topicIds.has(branch.topic_id)) errors.push(`${branch.branch_id}: branch parent topic does not exist`);
    const namingWarning = marketNameWarning(branch);
    if (namingWarning) warnings.push(`${branch.branch_id}: ${namingWarning}`);
  }
  for (const provisional of input.registry.provisional_topics) {
    const canonical = input.registry.canonical_topics.find((topic) => topic.topic_id === provisional.provisional_topic_id);
    if (provisional.status === 'promoted') {
      // Promotion retains the original proposal as immutable registry history.
      // Its canonical record must now exist and be active, but this registry
      // transition does not assign a Stage.
      if (!canonical || canonical.status !== 'active') {
        errors.push(`${provisional.provisional_topic_id}: promoted provisional topic requires an active canonical record`);
      }
      continue;
    }
    if (canonical && canonical.status !== 'provisional') errors.push(`${provisional.provisional_topic_id}: provisional record cannot target an active canonical topic`);
  }

  return {
    validation_id: `topic_registry_validation_${input.generatedAt.slice(0, 10).replaceAll('-', '')}`,
    generated_at: input.generatedAt,
    status: errors.length ? 'failed' : 'passed',
    topic_count: input.registry.canonical_topics.length,
    alias_count: input.registry.aliases.length,
    branch_count: input.registry.branches.length,
    provisional_topic_count: input.registry.provisional_topics.length,
    unresolved_count: input.unresolvedCount ?? 0,
    errors,
    warnings,
  };
}

export function resolveTopic(candidate: EvidenceCandidate, registry: TopicRegistry): TopicResolution {
  const evidence = candidate.suggested_evidence;
  const text = normalize(`${candidate.original_quote} ${evidence.event_title} ${evidence.event_summary} ${evidence.topic_id} ${evidence.branch_id ?? ''}`);
  const exactTopic = registry.canonical_topics.find((topic) => topic.topic_id === evidence.topic_id);
  const exactBranch = evidence.branch_id ? registry.branches.find((branch) => branch.branch_id === evidence.branch_id) : undefined;
  const alias = registry.aliases.find((item) => text.includes(normalize(item.alias)) || normalize(evidence.topic_id) === normalize(item.alias))
    ?? canonicalNameAlias(text, registry);
  const memoryHit = registry.memory_topic_ids.includes(evidence.topic_id) || (alias ? registry.memory_topic_ids.includes(alias.topic_id) : false);

  if (exactTopic && evidence.scope === 'branch' && evidence.branch_id && !exactBranch) {
    return resolution(candidate.candidate_id, 'new_branch', exactTopic.topic_id, evidence.branch_id, null, `Branch ${evidence.branch_id} is not in the branch registry; create branch audit before using it.`, 'medium', true, [
      { status: 'existing_topic', topic_id: exactTopic.topic_id, reason: 'Parent topic exists, but branch is not canonical yet.' },
    ]);
  }

  if (memoryHit && reactivationLanguage(text)) {
    const topicId = alias?.topic_id ?? evidence.topic_id;
    return resolution(candidate.candidate_id, 'reactivation', topicId, exactBranch?.branch_id ?? evidence.branch_id ?? null, null, `Narrative Memory contains ${topicId}; old theme language requires reactivation audit.`, 'medium', true, [
      { status: alias ? 'alias_of' : 'existing_topic', topic_id: topicId, branch_id: exactBranch?.branch_id ?? null, reason: 'Memory lookup matched before treating this as a new topic.' },
    ]);
  }

  // A caller that already provides the canonical id is not using an alias,
  // even when the quoted source also contains a canonical market name.
  if (exactTopic && (evidence.scope === 'parent' || !evidence.branch_id || exactBranch)) {
    return resolution(candidate.candidate_id, 'existing_topic', exactTopic.topic_id, exactBranch?.branch_id ?? evidence.branch_id ?? null, null, `Matched canonical topic ${exactTopic.topic_id}.`, 'high', false, []);
  }

  if (alias) {
    return resolution(candidate.candidate_id, 'alias_of', alias.topic_id, branchForAlias(alias.topic_id, text, registry), null, `Matched alias "${alias.alias}" for canonical topic ${alias.topic_id}.`, 'high', true, [
      { status: 'existing_topic', topic_id: alias.topic_id, reason: alias.reason },
    ]);
  }

  if (evidence.topic_id === 'unknown_topic' || unresolvedLanguage(text)) {
    // Rule-based fallback: when the provider gave no topic, infer one from the
    // quote itself. If a concrete direction is detected, propose it as a new
    // provisional topic so the autonomous pipeline can register it; only truly
    // ambiguous evidence stays unresolved.
    const hint = inferTopic(text);
    if (hint.topic_id !== 'unknown_topic') {
      const registeredProvisionalId = `provisional_${hint.topic_id}`;
      const registered = registry.canonical_topics.find((topic) => topic.topic_id === registeredProvisionalId);
      if (registered) {
        return resolution(candidate.candidate_id, 'existing_topic', registered.topic_id, hint.branch_id ?? null, null, `Rule inference matched already-registered provisional topic ${registered.topic_id}.`, 'high', false, []);
      }
    }
    if (hint.topic_id !== 'unknown_topic' && !registry.canonical_topics.some((topic) => topic.topic_id === hint.topic_id)) {
      const provisionalId = `provisional_${hint.topic_id}`;
      return resolution(candidate.candidate_id, 'new_provisional_topic', null, null, provisionalId, `Rule inference detected "${hint.topic_id}" from quote language; keep as provisional S0 until audited.`, 'medium', true, [
        { status: 'unresolved', reason: 'Alternative is to leave candidate unresolved until more context exists.' },
      ]);
    }
    if (hint.topic_id !== 'unknown_topic') {
      const exactTopic = registry.canonical_topics.find((topic) => topic.topic_id === hint.topic_id);
      const branchId = hint.branch_id && registry.branches.some((branch) => branch.branch_id === hint.branch_id) ? hint.branch_id : hint.branch_id;
      if (exactTopic && hint.branch_id && !registry.branches.some((branch) => branch.branch_id === hint.branch_id)) {
        return resolution(candidate.candidate_id, 'new_branch', exactTopic.topic_id, hint.branch_id, null, `Rule inference mapped to existing topic ${exactTopic.topic_id} with new branch ${hint.branch_id}.`, 'medium', true, [
          { status: 'existing_topic', topic_id: exactTopic.topic_id, reason: 'Parent topic exists, but branch is not canonical yet.' },
        ]);
      }
      if (exactTopic) {
        return resolution(candidate.candidate_id, 'existing_topic', exactTopic.topic_id, branchId, null, `Rule inference matched canonical topic ${exactTopic.topic_id}.`, 'medium', false, []);
      }
    }
    return resolution(candidate.candidate_id, 'unresolved', null, null, null, 'Topic/branch evidence is too ambiguous; operator must resolve before import.', 'low', true, []);
  }

  // Evidence carries a topic id that is neither canonical nor unknown: it is
  // either an already-registered provisional (existing_topic), a fresh
  // provisional_* id proposed by the model (reuse as-is), or a new plain
  // direction (register under provisional_<slug>).
  if (evidence.topic_id.startsWith('provisional_')) {
    const alreadyRegistered = registry.provisional_topics.some((topic) => topic.provisional_topic_id === evidence.topic_id)
      || registry.canonical_topics.some((topic) => topic.topic_id === evidence.topic_id);
    if (alreadyRegistered) {
      return resolution(candidate.candidate_id, 'existing_topic', evidence.topic_id, evidence.branch_id ?? null, null, `Already-registered provisional topic ${evidence.topic_id}.`, 'high', false, []);
    }
    return resolution(candidate.candidate_id, 'new_provisional_topic', null, evidence.scope === 'branch' ? evidence.branch_id ?? null : null, evidence.topic_id, `Model proposed provisional topic ${evidence.topic_id}; keep as provisional S0 until audited.`, 'medium', true, [
      { status: 'unresolved', reason: 'Alternative is to leave candidate unresolved until more context exists.' },
    ]);
  }
  const provisionalId = `provisional_${slug(evidence.topic_id || evidence.event_title)}`;
  return resolution(candidate.candidate_id, 'new_provisional_topic', null, evidence.scope === 'branch' ? evidence.branch_id ?? null : null, provisionalId, 'No canonical topic or alias matched; keep as provisional S0 until audited.', 'low', true, [
    { status: 'unresolved', reason: 'Alternative is to leave candidate unresolved until more context exists.' },
  ]);
}

export function buildTopicResolutionAudit(input: {
  sessionId?: string | null;
  candidates: EvidenceCandidate[];
  registry: TopicRegistry;
  generatedAt: string;
}): TopicResolutionAudit {
  const resolutions = input.candidates.map((candidate) => resolveTopic(candidate, input.registry));
  const unresolved = resolutions.filter((item) => item.status === 'unresolved');
  const auditScope = slug(input.sessionId ?? 'no_session');
  const auditTime = input.generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17);
  return {
    audit_id: `topic_resolution_${auditScope}_${auditTime}`,
    generated_at: input.generatedAt,
    session_id: input.sessionId ?? null,
    resolutions,
    unresolved_queue: unresolved,
    registry_validation: validateTopicRegistry({ registry: input.registry, generatedAt: input.generatedAt, unresolvedCount: unresolved.length }),
    guardrail_check: {
      no_forced_mapping: resolutions.every((item) => item.status !== 'unresolved' || item.resolved_topic_id === null),
      provisional_topics_do_not_inherit_stage: true,
      topic_changes_require_audit: resolutions.every((item) => !['alias_of', 'new_branch', 'reactivation', 'new_provisional_topic'].includes(item.status) || item.audit_required),
      branch_changes_do_not_upgrade_parent: true,
    },
  };
}

function resolution(
  candidateId: string,
  status: TopicResolution['status'],
  topicId: string | null,
  branchId: string | null,
  provisionalId: string | null,
  reason: string,
  confidence: TopicResolution['confidence'],
  auditRequired: boolean,
  alternatives: TopicResolution['alternatives'],
): TopicResolution {
  return {
    candidate_id: candidateId,
    status,
    resolved_topic_id: topicId,
    resolved_branch_id: branchId,
    provisional_topic_id: provisionalId,
    reason,
    confidence,
    audit_required: auditRequired,
    alternatives,
  };
}

function branchForAlias(topicId: string, text: string, registry: TopicRegistry): string | null {
  return registry.branches.find((branch) => branch.topic_id === topicId && (
    text.includes(normalize(branch.branch_name))
    || text.includes(normalize(branch.market_name_zh ?? ''))
    || text.includes(normalize(branch.market_name_en ?? ''))
  ))?.branch_id ?? null;
}

function canonicalNameAlias(text: string, registry: TopicRegistry): { alias: string; topic_id: string; reason: string } | undefined {
  const topic = registry.canonical_topics.find((item) => {
    const chineseName = normalize(item.market_name_zh ?? item.topic_name);
    const englishName = normalize(item.market_name_en ?? '');
    return Boolean(chineseName && text.includes(chineseName)) || Boolean(englishName && text.includes(englishName));
  });
  return topic
    ? { alias: topic.market_name_zh ?? topic.topic_name, topic_id: topic.topic_id, reason: 'Matched source-backed canonical market name.' }
    : undefined;
}

function reactivationLanguage(text: string): boolean {
  return /reactivation|revival|old theme|again|returns|follow-up|memory/.test(text);
}

function unresolvedLanguage(text: string): boolean {
  return /unknown|unclear|ambiguous|cannot determine|unresolved/.test(text);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim();
}

function slug(value: string): string {
  return normalize(value).replace(/\s+/g, '_').slice(0, 48) || 'unknown';
}
