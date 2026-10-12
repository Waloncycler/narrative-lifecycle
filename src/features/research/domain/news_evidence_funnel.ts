import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { CompanyResearchRegistry, ResearchUniverse } from '@/features/research/types/research_coverage';
import type { WorldMonitorSignal } from '@/features/worldmonitor/types/worldmonitor_adapter';

export type NewsEventClass = 'regulatory' | 'clinical' | 'corporate_disclosure' | 'commercial_contract' | 'financing' | 'production' | 'research_result' | 'macro_data' | 'risk_event' | 'market_commentary' | 'other';

export interface NewsResearchAnalysis {
  event_class: NewsEventClass;
  cluster_id: string;
  evidence_potential_score: number;
  topic_id: string | null;
  branch_id: string | null;
  mapping_basis: 'topic_term' | 'company_coverage' | 'universe_seed' | 'unresolved';
  evidence_lane: 'direct_fact' | 'source_recovery' | 'discovery_only';
  verification_targets: string[];
  reasons: string[];
}

export interface NewsEvidenceFunnelReport {
  artifact_type: 'news_evidence_funnel_report';
  schema_version: '1.0.0';
  generated_at: string;
  input_signal_count: number;
  news_signal_count: number;
  cluster_count: number;
  mapped_topic_count: number;
  direct_fact_count: number;
  source_recovery_count: number;
  discovery_only_count: number;
  selected_count: number;
  selected_by_event_class: Record<string, number>;
  selected_by_topic: Record<string, number>;
  suppressed_duplicate_count: number;
  suppressed_budget_count: number;
  guardrail_check: {
    importance_is_not_evidence_strength: true;
    search_results_remain_context_only: true;
    parent_branch_separation: true;
    no_trading_advice: true;
  };
}

export function analyzeNewsEvidenceSignals(input: {
  signals: WorldMonitorSignal[];
  registry: TopicRegistry;
  universe: ResearchUniverse;
  companies: CompanyResearchRegistry;
}): WorldMonitorSignal[] {
  return input.signals.map((signal) => signal.event_type === 'NEWS_ARTICLE_PUBLISHED'
    ? { ...signal, research_analysis: analyzeSignal(signal, input.registry, input.universe, input.companies) }
    : signal);
}

/** Selects broad coverage without allowing one viral source or topic to consume
 * the whole analysis budget. One representative per event cluster is kept. */
export function selectNewsEvidenceSignals(input: { signals: WorldMonitorSignal[]; limit: number; generatedAt: string }): {
  signals: WorldMonitorSignal[];
  report: NewsEvidenceFunnelReport;
} {
  const news = input.signals.filter((signal) => signal.event_type === 'NEWS_ARTICLE_PUBLISHED');
  const nonNews = input.signals.filter((signal) => signal.event_type !== 'NEWS_ARTICLE_PUBLISHED');
  const representatives = new Map<string, WorldMonitorSignal>();
  for (const signal of news) {
    const key = signal.research_analysis?.cluster_id ?? signal.signal_id;
    const current = representatives.get(key);
    if (!current || signalScore(signal) > signalScore(current)) representatives.set(key, signal);
  }
  const uniqueNews = [...representatives.values()].sort((left, right) => signalScore(right) - signalScore(left));
  const relevantNews = uniqueNews.filter((signal: WorldMonitorSignal) => {
    const analysis = signal.research_analysis;
    if (!analysis) return false;
    if (analysis.topic_id) return true;
    if (analysis.evidence_lane === 'direct_fact') return true;
    if (analysis.evidence_lane === 'source_recovery' && analysis.event_class !== 'other' && analysis.event_class !== 'market_commentary') return true;
    return false;
  });
  const buckets = new Map<string, WorldMonitorSignal[]>();
  for (const signal of relevantNews) {
    const analysis = signal.research_analysis;
    const key = analysis?.topic_id ? `topic:${analysis.topic_id}` : `event:${analysis?.event_class ?? 'other'}`;
    buckets.set(key, [...(buckets.get(key) ?? []), signal]);
  }
  const nonNewsLimit = news.length ? Math.min(nonNews.length, Math.floor(input.limit * 0.35)) : input.limit;
  const selectedNonNews = nonNews.slice(0, nonNewsLimit);
  const selectedNews = roundRobin([...buckets.values()], Math.max(0, input.limit - selectedNonNews.length));
  const selected = [...selectedNonNews, ...selectedNews].slice(0, input.limit);
  const report: NewsEvidenceFunnelReport = {
    artifact_type: 'news_evidence_funnel_report', schema_version: '1.0.0', generated_at: input.generatedAt,
    input_signal_count: input.signals.length, news_signal_count: news.length, cluster_count: representatives.size,
    mapped_topic_count: news.filter((signal) => Boolean(signal.research_analysis?.topic_id)).length,
    direct_fact_count: countLane(news, 'direct_fact'), source_recovery_count: countLane(news, 'source_recovery'), discovery_only_count: countLane(news, 'discovery_only'),
    selected_count: selected.length,
    selected_by_event_class: counts(selectedNews.map((signal) => signal.research_analysis?.event_class ?? 'other')),
    selected_by_topic: counts(selectedNews.map((signal) => signal.research_analysis?.topic_id ?? 'unresolved')),
    suppressed_duplicate_count: Math.max(0, news.length - representatives.size),
    suppressed_budget_count: Math.max(0, uniqueNews.length - selectedNews.length),
    guardrail_check: { importance_is_not_evidence_strength: true, search_results_remain_context_only: true, parent_branch_separation: true, no_trading_advice: true },
  };
  return { signals: selected, report };
}

function analyzeSignal(signal: WorldMonitorSignal, registry: TopicRegistry, universe: ResearchUniverse, companies: CompanyResearchRegistry): NewsResearchAnalysis {
  const text = `${signal.event_title} ${signal.event_summary} ${signal.source_quote ?? ''}`;
  const eventClass = classifyEvent(text);
  const topicMatch = matchTopic(signal.event_title, text, registry, universe, companies);
  const reasons: string[] = [];
  let score = 10;
  const eventWeight: Record<NewsEventClass, number> = { regulatory: 35, clinical: 34, corporate_disclosure: 32, commercial_contract: 30, financing: 28, production: 30, research_result: 24, macro_data: 28, risk_event: 24, market_commentary: 8, other: 5 };
  score += eventWeight[eventClass]; reasons.push(`event_class:${eventClass}`);
  if (topicMatch.topic_id) { score += 20; reasons.push(`mapped_topic:${topicMatch.topic_id}`); }
  const numbers = text.match(/\d+(?:\.\d+)?%?|\d+(?:\.\d+)?(?:亿|万|兆|亿美元|亿元|million|billion)/gi) ?? [];
  if (numbers.length) { score += Math.min(15, numbers.length * 3); reasons.push(`numeric_anchors:${numbers.length}`); }
  if ((signal.source_quote?.trim().length ?? 0) >= 80) { score += 10; reasons.push('substantive_source_quote'); }
  if (signal.upstream_record_id || signal.source_url) { score += 5; reasons.push('stable_source_identity'); }
  if (/据悉|知情人士|传闻|rumou?r|sources? said|may|might|预计|预测/i.test(text)) { score -= 18; reasons.push('unverified_or_forecast_language'); }
  if (eventClass === 'market_commentary' || eventClass === 'other') score -= 8;
  const bounded = Math.max(0, Math.min(100, score));
  const lane = bounded >= 70 && ['regulatory', 'clinical', 'corporate_disclosure', 'macro_data'].includes(eventClass)
    ? 'direct_fact' as const
    : bounded >= 48 ? 'source_recovery' as const : 'discovery_only' as const;
  return {
    event_class: eventClass, cluster_id: `event_${hash(clusterText(signal.event_title))}`, evidence_potential_score: bounded,
    topic_id: topicMatch.topic_id, branch_id: topicMatch.branch_id, mapping_basis: topicMatch.basis,
    evidence_lane: lane, verification_targets: verificationTargets(eventClass), reasons,
  };
}

function classifyEvent(text: string): NewsEventClass {
  if (/监管|法规|政策|批复|批准|禁令|处罚|立法|regulat|policy|approval|approved|law\b|sanction/i.test(text)) return 'regulatory';
  if (/临床|试验|患者|适应症|NCT\d+|clinical|trial|phase\s*[123]/i.test(text)) return 'clinical';
  if (/公告|财报|业绩|披露|filing|annual report|earnings|guidance/i.test(text)) return 'corporate_disclosure';
  if (/中标|订单|合同|采购|授权|许可|合作协议|contract|order|procurement|licens/i.test(text)) return 'commercial_contract';
  if (/融资|发债|债券|募资|并购|收购|投资|financ|bond|funding|acquisition|merger/i.test(text)) return 'financing';
  if (/投产|量产|产能|交付|装机|出货|production|capacity|shipment|delivery/i.test(text)) return 'production';
  if (/论文|研究发现|实验结果|突破|paper|study finds|research result|breakthrough/i.test(text)) return 'research_result';
  if (/GDP|CPI|PPI|PMI|就业|通胀|进出口|产值|同比|环比|macro|inflation|payroll/i.test(text)) return 'macro_data';
  if (/事故|召回|违约|调查|诉讼|风险|attack|breach|recall|default|investigation|lawsuit/i.test(text)) return 'risk_event';
  if (/观点|认为|表示|预计|展望|评论|opinion|outlook|expects?|predict/i.test(text)) return 'market_commentary';
  return 'other';
}

function matchTopic(title: string, fullText: string, registry: TopicRegistry, universe: ResearchUniverse, companies: CompanyResearchRegistry): { topic_id: string | null; branch_id: string | null; basis: NewsResearchAnalysis['mapping_basis'] } {
  const termsByTopic = new Map<string, string[]>();
  for (const topic of registry.canonical_topics.filter((item) => item.status !== 'archived')) termsByTopic.set(topic.topic_id, [topic.topic_name, topic.market_name_zh ?? '', topic.market_name_en ?? '']);
  for (const alias of registry.aliases) termsByTopic.set(alias.topic_id, [...(termsByTopic.get(alias.topic_id) ?? []), alias.alias]);
  // A Topic assignment requires headline-level relevance. Summary-only
  // mentions remain discovery context and cannot relabel the whole event.
  const matches = [...termsByTopic.entries()].map(([topicId, terms]) => ({ topicId, score: bestTerm(title, terms) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  let topicId = matches.length && (matches[1]?.score ?? -1) !== matches[0]!.score ? matches[0]!.topicId : null;
  let basis: NewsResearchAnalysis['mapping_basis'] = topicId ? 'topic_term' : 'unresolved';
  if (!topicId) {
    const matchedCompanies = companies.companies.filter((company) => [company.display_name_zh, company.display_name_en, ...company.aliases].some((term) => includesTerm(title, term)));
    const possible = [...new Set(matchedCompanies.flatMap((company) => company.coverage_node_ids).flatMap((nodeId) => [nodeId, `provisional_${nodeId}`]))]
      .filter((id) => registry.canonical_topics.some((topic) => topic.topic_id === id));
    if (possible.length === 1) { topicId = possible[0]!; basis = 'company_coverage'; }
  }
  if (!topicId) {
    const seeds = universe.nodes.map((node) => ({ node, score: bestTerm(title, [node.display_name_zh, node.display_name_en, ...node.aliases]) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    if (seeds.length && (seeds[1]?.score ?? -1) !== seeds[0]!.score) {
      const active = registry.canonical_topics.find((topic) => topic.topic_id === seeds[0]!.node.node_id || topic.topic_id === `provisional_${seeds[0]!.node.node_id}`);
      if (active) { topicId = active.topic_id; basis = 'universe_seed'; }
    }
  }
  const branch = topicId ? registry.branches.map((item) => ({ item, score: item.topic_id === topicId ? bestTerm(`${title} ${fullText}`, [item.branch_name, item.market_name_zh ?? '', item.market_name_en ?? '']) : 0 })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score) : [];
  return { topic_id: topicId, branch_id: branch.length && (branch[1]?.score ?? -1) !== branch[0]!.score ? branch[0]!.item.branch_id : null, basis };
}

function verificationTargets(eventClass: NewsEventClass): string[] {
  const targets: Record<NewsEventClass, string[]> = {
    regulatory: ['regulator_record', 'statutory_document'], clinical: ['trial_registry', 'regulator_record'], corporate_disclosure: ['exchange_filing', 'company_ir'],
    commercial_contract: ['procurement_record', 'company_ir', 'counterparty_confirmation'], financing: ['exchange_filing', 'company_ir', 'regulator_record'],
    production: ['company_ir', 'regulator_statistics', 'customer_confirmation'], research_result: ['paper_or_doi', 'institution_release'], macro_data: ['official_statistics'],
    risk_event: ['regulator_record', 'company_filing', 'court_or_recall_record'], market_commentary: ['named_primary_interview'], other: ['original_source'],
  };
  return targets[eventClass];
}

function signalScore(signal: WorldMonitorSignal): number { return (signal.research_analysis?.evidence_potential_score ?? 0) * 2 + (signal.metrics?.news_importance_score ?? 0); }
function countLane(signals: WorldMonitorSignal[], lane: NewsResearchAnalysis['evidence_lane']): number { return signals.filter((signal) => signal.research_analysis?.evidence_lane === lane).length; }
function counts(values: string[]): Record<string, number> { const result: Record<string, number> = {}; for (const value of values) result[value] = (result[value] ?? 0) + 1; return result; }
function roundRobin<T>(groups: T[][], limit: number): T[] { const result: T[] = []; const max = Math.max(0, ...groups.map((group) => group.length)); for (let i = 0; i < max && result.length < limit; i += 1) for (const group of groups) { if (group[i] !== undefined) result.push(group[i]!); if (result.length >= limit) break; } return result; }
function bestTerm(text: string, terms: string[]): number { return Math.max(0, ...terms.map((term) => includesTerm(text, term) ? normalize(term).length : 0)); }
function includesTerm(text: string, term: string): boolean {
  const value = normalize(term);
  if (value.length < 3) return false;
  if (/^[a-z0-9.+-]+$/i.test(term.trim())) {
    const escaped = term.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(text.toLowerCase());
  }
  return normalize(text).includes(value);
}
function normalize(value: string): string { return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ''); }
function clusterText(value: string): string {
  const withoutPublisher = value
    .replace(/^[【\[][^】\]]{1,24}[】\]]\s*/u, '')
    .replace(/^(财联社|新浪财经|证券时报|上海证券报|中国证券报|央视新闻|新华社|Reuters|Bloomberg|WSJ)\s*[:：|·-]?\s*/i, '')
    .replace(/\b(?:exclusive|breaking|update|analysis)\b\s*[:：|·-]?/gi, '');
  const numbers = withoutPublisher.match(/\d+(?:\.\d+)?/g)?.slice(0, 4).join('_') ?? '';
  return `${normalize(withoutPublisher).slice(0, 120)}|${numbers}`;
}
function hash(value: string): string { let hashValue = 2166136261; for (const char of value) { hashValue ^= char.charCodeAt(0); hashValue = Math.imul(hashValue, 16777619); } return (hashValue >>> 0).toString(16).padStart(8, '0'); }
