import { marketBranchName, marketTopicName } from '@/features/narrative/domain/market_naming';
import { supportsTermQuery } from '@/features/research/domain/direct_source_research';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type {
  AuthoritativeResearchSource,
  AuthoritativeSourceAtlas,
  CompanyResearchRegistry,
  CompanyResearchTarget,
  ResearchCampaign,
  ResearchCampaignCompanyTarget,
  ResearchCampaignTask,
  ResearchCoverageLayer,
  ResearchUniverse,
  ResearchUniverseNode,
} from '@/features/research/types/research_coverage';
import type { ResearchBaselineCompletionReport } from '@/features/research/types/research_baseline_completion';
import type { HistoricalEvidenceRecoveryReport, HistoricalEvidenceRecoveryTask } from '@/features/research/types/historical_evidence_recovery';

const TIER_WEIGHT = {
  statutory: 70,
  regulator: 65,
  intergovernmental: 60,
  filing: 55,
  academic: 50,
  company: 40,
  news: 20,
} as const;

// This mapping is deliberately empty until a direct operation accepts a
// campaign-specific query. Existing operations such as the WHO outbreak feed
// and the NASA event feed are real public APIs, but their fixed endpoints are
// not evidence about every health or technology Topic. An atlas entry with a
// public API is therefore not silently treated as a queryable connector.
const DIRECT_OPERATION_BY_SOURCE: Record<string, string[]> = {
};

/**
 * Plans a bounded, source-aware discovery campaign. It deliberately returns
 * research tasks only: a seed is not a Topic and a search hit is not Evidence.
 */
export function buildResearchCampaign(input: {
  registry: TopicRegistry;
  atlas: AuthoritativeSourceAtlas;
  universe: ResearchUniverse;
  companies?: CompanyResearchRegistry;
  generatedAt: string;
  producerVersion: string;
  maxTasks?: number;
  /** Read-only gap plan generated from the current snapshot. It only changes
   * research order and coverage layers; it cannot create Evidence or Stage. */
  baselineCompletion?: ResearchBaselineCompletionReport | null;
  /** Read-only timeline-gap plan. It can only prioritize existing research. */
  historicalRecovery?: HistoricalEvidenceRecoveryReport | null;
}): ResearchCampaign {
  const knownNames = new Set(input.registry.canonical_topics.flatMap((topic) => [
    normalize(marketTopicName(topic)),
    normalize(topic.market_name_en ?? ''),
    normalize(topic.topic_name),
  ]).filter(Boolean));
  for (const alias of input.registry.aliases) knownNames.add(normalize(alias.alias));

  const tasks: ResearchCampaignTask[] = [];
  const baselineByTopic = new Map(input.baselineCompletion?.items
    .filter((item) => item.kind === 'parent_evidence_baseline')
    .map((item) => [item.topic_id, item]) ?? []);
  const recoveryByTopic = new Map(input.historicalRecovery?.tasks
    .filter((item) => item.scope === 'parent')
    .map((item) => [item.topic_id, item]) ?? []);
  const topics = input.registry.canonical_topics
    .filter((topic) => topic.status !== 'archived')
    .map((topic) => {
      const matchedSeed = input.universe.nodes.find((node) => [node.node_id, node.display_name_zh, node.display_name_en, ...node.aliases]
        .some((name) => normalize(name) === normalize(marketTopicName(topic)) || normalize(name) === normalize(topic.market_name_en ?? '')));
      const recovery = recoveryByTopic.get(topic.topic_id);
      return {
      node_kind: topic.status === 'active' ? 'formal_topic' as const : 'provisional_topic' as const,
      topic_id: topic.topic_id,
      candidate_node_id: null,
      display_name_zh: marketTopicName(topic),
      display_name_en: topic.market_name_en ?? null,
      domain: matchedSeed?.domain ?? inferDomain(`${marketTopicName(topic)} ${topic.market_name_en ?? ''}`),
      // A curated S0 topic is eligible for coverage, not an implicit Stage
      // upgrade. Established topics keep a small recurring coverage reserve;
      // the remaining curated core rotates across runs.
      priority: recovery ? 150 : baselineByTopic.has(topic.topic_id) ? 125 : topic.status === 'active' ? (topic.current_stage === 'S0' ? 90 : 95) : 65,
      target_layers: mergeLayers(mergeLayers(matchedSeed?.target_layers ?? ['name', 'reality', 'capital'] as ResearchCoverageLayer[], baselineByTopic.get(topic.topic_id)?.required_layers ?? []), recovery?.required_layers ?? []),
      preferred_source_ids: matchedSeed?.preferred_source_ids ?? [] as string[],
      formal_status: topic.status === 'active' ? 'formal' as const : 'provisional' as const,
      historical_recovery: recovery,
      };
    });

  for (const topic of topics) tasks.push(taskForTopic(topic, input.atlas, input.companies?.companies ?? []));

  const seeded = input.universe.nodes
    .filter((node) => ![node.display_name_zh, node.display_name_en, ...node.aliases].some((name) => knownNames.has(normalize(name))))
    .filter((node) => usableMarketLabel(node.display_name_zh));
  for (const node of seeded) tasks.push(taskForSeed(node, input.atlas, input.companies?.companies ?? []));

  let skippedUnresolvedBranches = 0;
  for (const branch of input.registry.branches) {
    const topic = input.registry.canonical_topics.find((item) => item.topic_id === branch.topic_id);
    const name = marketBranchName(branch);
    if (!topic || branch.naming_status === 'unresolved' || !usableMarketLabel(name)) {
      skippedUnresolvedBranches += 1;
      continue;
    }
    tasks.push(taskForBranch({
      topic_id: topic.topic_id,
      topic_name: marketTopicName(topic),
      topic_name_en: topic.market_name_en ?? null,
      branch_id: branch.branch_id,
      branch_name: name,
      branch_name_en: branch.market_name_en ?? null,
      domain: inferDomain(`${marketTopicName(topic)} ${name}`),
    }, input.atlas, input.companies?.companies ?? []));
  }

  const deduplicated = dedupeTasks(tasks)
    .sort((left, right) => right.priority - left.priority || left.task_id.localeCompare(right.task_id));
  const selectedTasks = selectCampaignTasks(deduplicated, input.maxTasks ?? 60, coverageWindowOffset(input.generatedAt));
  return {
    artifact_type: 'research_campaign',
    schema_version: '1.0.0',
    producer_version: input.producerVersion,
    campaign_id: `research_campaign_${input.generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
    generated_at: input.generatedAt,
    source_atlas_version: input.atlas.atlas_version,
    universe_version: input.universe.universe_version,
    tasks: selectedTasks,
    summary: {
      formal_topic_count: topics.filter((topic) => topic.formal_status === 'formal').length,
      provisional_topic_count: topics.filter((topic) => topic.formal_status === 'provisional').length,
      universe_seed_count: seeded.length,
      branch_count: input.registry.branches.length - skippedUnresolvedBranches,
      source_target_count: new Set(selectedTasks.flatMap((task) => task.source_ids)).size,
      task_count: selectedTasks.length,
      skipped_unresolved_branch_count: skippedUnresolvedBranches,
    },
    guardrail_check: {
      research_seeds_are_not_formal_topics: true,
      source_capability_is_not_connectivity_claim: true,
      search_results_remain_context_only: true,
      parent_branch_separation: true,
      evidence_table_required_for_stage: true,
      no_auto_import: true,
      no_trading_advice: true,
    },
  };
}

function selectCampaignTasks(tasks: ResearchCampaignTask[], maxTasks: number, seedOffset: number): ResearchCampaignTask[] {
  if (tasks.length <= maxTasks || maxTasks < 8) return tasks.slice(0, maxTasks);
  const selected: ResearchCampaignTask[] = [];
  const take = (kind: ResearchCampaignTask['node_kind'], count: number): void => {
    const items = tasks.filter((item) => item.node_kind === kind);
    if (kind === 'formal_topic') {
      const established = items.filter((item) => item.priority > 90);
      const curatedS0 = items.filter((item) => item.priority <= 90);
      selected.push(...established.slice(0, count));
      const remaining = Math.max(0, count - established.length);
      selected.push(...rotate(curatedS0, seedOffset).slice(0, remaining));
      return;
    }
    const ordered = kind === 'universe_seed' ? rotate(items, seedOffset) : items;
    for (const task of ordered.slice(0, count)) selected.push(task);
  };
  // A campaign that never reaches research seeds cannot discover a new Topic.
  // Reserve a bounded share while preserving ongoing formal-topic and branch
  // coverage; any remaining capacity follows normal priority ordering.
  take('formal_topic', Math.max(1, Math.ceil(maxTasks * 0.25)));
  take('universe_seed', Math.max(1, Math.floor(maxTasks / 3)));
  take('branch', Math.max(1, Math.floor(maxTasks * 0.2)));
  take('provisional_topic', Math.max(1, Math.floor(maxTasks * 0.2)));
  for (const task of tasks) {
    if (selected.length >= maxTasks) break;
    if (!selected.some((item) => item.task_id === task.task_id)) selected.push(task);
  }
  return selected.slice(0, maxTasks);
}

function coverageWindowOffset(generatedAt: string): number {
  const time = Date.parse(generatedAt);
  return Number.isFinite(time) ? Math.floor(time / (6 * 60 * 60 * 1_000)) : 0;
}

function mergeLayers(base: ResearchCoverageLayer[], additions: ResearchCoverageLayer[]): ResearchCoverageLayer[] {
  return [...new Set([...base, ...additions])] as ResearchCoverageLayer[];
}

function rotate<T>(values: T[], offset: number): T[] {
  if (!values.length) return values;
  const start = ((offset % values.length) + values.length) % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}

export function usableMarketLabel(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  return !/(?:对话窗口|发布方案|branch\s+[a-z0-9]+$|unknown|unresolved|待确认)/iu.test(trimmed);
}

function taskForTopic(node: {
  node_kind: 'formal_topic' | 'provisional_topic'; topic_id: string; candidate_node_id: null; display_name_zh: string; display_name_en: string | null; domain: string; priority: number; target_layers: ResearchCoverageLayer[]; preferred_source_ids: string[]; formal_status: 'formal' | 'provisional'; historical_recovery?: HistoricalEvidenceRecoveryTask;
}, atlas: AuthoritativeSourceAtlas, companies: CompanyResearchTarget[]): ResearchCampaignTask {
  const task = makeTask({ ...node, branch_id: null, rationale: node.historical_recovery
    ? `${node.historical_recovery.rationale} This remains research-only and must continue through source retrieval and Intake review.`
    : node.formal_status === 'formal'
    ? 'Track missing lifecycle layers and identify independently corroborable developments.'
    : 'Collect source-grounded material before this provisional topic can be considered for activation.' }, atlas, companies);
  return node.historical_recovery?.search_intents[0] ? { ...task, query: node.historical_recovery.search_intents[0] } : task;
}

function taskForSeed(node: ResearchUniverseNode, atlas: AuthoritativeSourceAtlas, companies: CompanyResearchTarget[]): ResearchCampaignTask {
  return makeTask({
    node_kind: 'universe_seed', topic_id: null, branch_id: null, candidate_node_id: node.node_id,
    display_name_zh: node.display_name_zh, display_name_en: node.display_name_en || null,
    domain: node.domain, priority: 35 + Math.max(0, Math.min(20, node.priority * 4)),
    target_layers: node.target_layers, preferred_source_ids: node.preferred_source_ids,
    formal_status: 'research_seed',
    rationale: 'Market-recognizable seed awaiting source-grounded discovery; it has no inherited stage or active-topic status.',
  }, atlas, companies);
}

function taskForBranch(input: {
  topic_id: string; topic_name: string; topic_name_en: string | null; branch_id: string; branch_name: string; branch_name_en: string | null; domain: string;
}, atlas: AuthoritativeSourceAtlas, companies: CompanyResearchTarget[]): ResearchCampaignTask {
  return makeTask({
    node_kind: 'branch', topic_id: input.topic_id, branch_id: input.branch_id, candidate_node_id: null,
    display_name_zh: input.branch_name, display_name_en: input.branch_name_en,
    domain: input.domain, priority: 72, target_layers: ['reality', 'capital', 'friction'], preferred_source_ids: [],
    formal_status: 'watch_branch',
    rationale: `Track the independent branch under ${input.topic_name}; any material remains branch-scoped and cannot upgrade the parent narrative.`,
    parent_name: input.topic_name,
    parent_name_en: input.topic_name_en,
  }, atlas, companies);
}

function makeTask(input: {
  node_kind: ResearchCampaignTask['node_kind']; topic_id: string | null; branch_id: string | null; candidate_node_id: string | null; display_name_zh: string; display_name_en: string | null; domain: string; priority: number; target_layers: ResearchCoverageLayer[]; preferred_source_ids: string[]; formal_status: ResearchCampaignTask['formal_status']; rationale: string; parent_name?: string; parent_name_en?: string | null;
}, atlas: AuthoritativeSourceAtlas, companies: CompanyResearchTarget[]): ResearchCampaignTask {
  const sources = selectSources(atlas.sources, input.domain, input.target_layers, input.preferred_source_ids, input.node_kind);
  const target = input.parent_name ? `${input.parent_name} ${input.display_name_zh}` : input.display_name_zh;
  const english = [input.parent_name_en, input.display_name_en].filter(Boolean).join(' ');
  const query = `${target}${english ? ` ${english}` : ''} 官方 政策 监管 审批 验证 产能 订单 临床 试验`;
  return {
    task_id: `campaign_${input.node_kind}_${safeId(input.topic_id ?? input.candidate_node_id ?? input.branch_id ?? input.display_name_zh)}`.slice(0, 120),
    node_kind: input.node_kind,
    topic_id: input.topic_id,
    branch_id: input.branch_id,
    candidate_node_id: input.candidate_node_id,
    display_name_zh: input.display_name_zh,
    display_name_en: input.display_name_en,
    domain: input.domain,
    priority: input.priority,
    target_layers: input.target_layers,
    query,
    source_ids: sources.map((source) => source.source_id),
    source_domains: sources.map(sourceDomain).filter((value): value is string => Boolean(value)),
    company_targets: companyTargetsFor(input, companies),
    direct_operation_ids: [...new Set(sources.flatMap((source) => DIRECT_OPERATION_BY_SOURCE[source.source_id] ?? []))],
    rationale: input.rationale,
    formal_status: input.formal_status,
  };
}

function companyTargetsFor(input: {
  topic_id: string | null;
  candidate_node_id: string | null;
  branch_id: string | null;
  display_name_zh: string;
  display_name_en: string | null;
}, companies: CompanyResearchTarget[]): ResearchCampaignCompanyTarget[] {
  const keys = new Set([
    input.topic_id,
    input.candidate_node_id,
    input.branch_id,
    input.display_name_zh,
    input.display_name_en,
  ].filter((value): value is string => Boolean(value)).map(normalize));
  return companies
    .filter((company) => company.coverage_node_ids.some((id) => keys.has(normalize(id))))
    .sort((left, right) => Number(right.status === 'curated') - Number(left.status === 'curated') || left.company_id.localeCompare(right.company_id))
    // Keep the company reference set broad enough to include both Chinese and
    // US leaders for cross-border technology Themes. These remain compact
    // verification targets, not a ranking or a recommendation list.
    .slice(0, 12)
    .map((company) => ({
      company_id: company.company_id,
      display_name_zh: company.display_name_zh,
      display_name_en: company.display_name_en,
      market: company.market,
      official_source_url: company.official_source_url,
      disclosure_source_ids: company.disclosure_source_ids,
    }));
}

function selectSources(
  sources: AuthoritativeResearchSource[],
  domain: string,
  targetLayers: ResearchCoverageLayer[],
  preferred: string[],
  nodeKind: ResearchCampaignTask['node_kind'],
): AuthoritativeResearchSource[] {
  const preferredSet = new Set(preferred);
  const discoveryCapable = sources
    .filter((source) => source.topic_discovery_capable)
    .filter((source) => nodeKind !== 'branch' || source.branch_discovery_capable);
  const exact = discoveryCapable.filter((source) => preferredSet.has(source.source_id) || source.domains.includes(domain));
  const fallback = discoveryCapable.filter((source) => preferredSet.has(source.source_id) || source.domains.includes('cross_industry'));
  const eligible = exact.length ? exact : fallback;
  const ranked = eligible
    .sort((left, right) => sourceWeight(right, preferredSet, domain, targetLayers) - sourceWeight(left, preferredSet, domain, targetLayers) || left.source_id.localeCompare(right.source_id))
    ;
  const selected = ranked.slice(0, 5);
  // Keep the highest-authority sources, then reserve up to two positions for
  // public APIs that can actually accept the campaign term. This avoids the
  // false choice between an NMPA/CDE-style regulator and useful discovery
  // coverage from scholarly or engineering registries.
  const desiredQueryable = Math.min(2, ranked.filter(supportsTermQuery).length);
  for (const source of ranked.filter(supportsTermQuery)) {
    if (selected.filter(supportsTermQuery).length >= desiredQueryable) break;
    if (selected.some((item) => item.source_id === source.source_id)) continue;
    const replacement = [...selected].reverse().findIndex((item) => !supportsTermQuery(item) && !preferredSet.has(item.source_id));
    if (replacement === -1) break;
    selected[selected.length - 1 - replacement] = source;
  }
  // Preserve an independently queryable scholarly path when one is available.
  // Authority sources remain present, but a health/technology campaign should
  // not lose all academic corroboration to cross-domain statutory feeds.
  const academicQueryable = ranked.find((source) => source.authority_tier === 'academic' && supportsTermQuery(source));
  if (academicQueryable && !selected.some((source) => source.source_id === academicQueryable.source_id)) {
    const replacement = [...selected].reverse().findIndex((source) => !preferredSet.has(source.source_id) && source.authority_tier !== 'academic');
    if (replacement >= 0) selected[selected.length - 1 - replacement] = academicQueryable;
  }
  return [...new Map(selected.map((source) => [source.source_id, source])).values()];
}

function sourceWeight(source: AuthoritativeResearchSource, preferred: Set<string>, domain: string, targetLayers: ResearchCoverageLayer[]): number {
  const layerMatches = source.coverage_layers.filter((layer) => targetLayers.includes(layer)).length;
  // A source that names one or two domains is generally more useful for a
  // topic-specific campaign than a broad statistical or policy source with
  // the same nominal domain tag. Broad sources remain available as fallback.
  const domainSpecificity = Math.max(0, 30 - Math.max(0, source.domains.length - 1) * 5);
  return TIER_WEIGHT[source.authority_tier]
    + (preferred.has(source.source_id) ? 100 : 0)
    + (source.domains.includes(domain) ? 35 : 0)
    + layerMatches * 8
    + domainSpecificity
    + (source.automated_polling_allowed ? 4 : 0);
}

function sourceDomain(source: AuthoritativeResearchSource): string | null {
  try { return new URL(source.base_url).hostname.toLowerCase(); } catch { return null; }
}

function dedupeTasks(tasks: ResearchCampaignTask[]): ResearchCampaignTask[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = `${task.node_kind}:${task.topic_id ?? task.candidate_node_id}:${task.branch_id ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferDomain(value: string): string {
  const text = value.toLowerCase();
  // BCI combines engineering and clinical translation. For coverage planning
  // its higher-risk evidence gaps are clinical and regulatory, so health is
  // the primary retrieval domain; technology sources remain available through
  // the existing registry and Source Atlas rather than being used as a proxy.
  if (/脑机接口|\bbci\b|brain[ -]?computer/.test(text)) return 'health';
  if (/药|医疗|clinical|drug|biopharma|brain/.test(text)) return 'health';
  if (/芯片|半导体|ai|模型|机器人|量子|软件|计算|cyber|space/.test(text)) return 'technology';
  if (/能源|电池|光伏|风电|储能|氢|核|矿/.test(text)) return 'energy';
  if (/宏观|消费|地产|金融|授权|金融|保险/.test(text)) return 'financial';
  return 'cross_industry';
}

function normalize(value: string): string { return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ''); }
function safeId(value: string): string { return normalize(value).replace(/[^a-z0-9]+/g, '_') || 'node'; }
