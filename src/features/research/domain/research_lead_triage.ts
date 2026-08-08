import type { DirectSourceResearchReport } from '@/features/research/types/direct_source_research';
import type { AuthoritativeSourceAtlas, CompanyResearchRegistry } from '@/features/research/types/research_coverage';
import type {
  ResearchLeadDisposition,
  ResearchLeadFreshness,
  ResearchLeadOrigin,
  ResearchLeadRelevance,
  ResearchLeadSourceClass,
  ResearchLeadTriageItem,
  ResearchLeadTriageReport,
} from '@/features/research/types/research_lead_triage';
import type { WebResearchLead, WebResearchReport } from '@/features/research/types/web_research';

type RawLead = {
  origin: ResearchLeadOrigin;
  origin_lead_id: string;
  topic_id: string | null;
  branch_id: string | null;
  candidate_node_id: string | null;
  title: string;
  url: string;
  source_name: string;
  source_domain: string;
  snippet: string;
  published_at: string | null;
  retrieved_at: string;
  query: string | null;
  source_id: string | null;
};

/** Turns broad discovery output into a transparent review queue. This rule
 * deliberately does not create Evidence candidates or lifecycle judgments. */
export function buildResearchLeadTriage(input: {
  webResearch: WebResearchReport | null;
  directResearch: DirectSourceResearchReport | null;
  sourceAtlas: AuthoritativeSourceAtlas;
  companies: CompanyResearchRegistry;
  generatedAt: string;
  producerVersion: string;
}): ResearchLeadTriageReport {
  const raw = [
    ...webLeads(input.webResearch),
    ...directLeads(input.directResearch),
  ];
  const grouped = groupByScopeAndUrl(raw);
  const items = [...grouped.values()]
    .map((group) => triageGroup(group, input))
    .sort((left, right) => right.priority_score - left.priority_score || left.triage_id.localeCompare(right.triage_id));
  const summary = {
    priority_review_count: items.filter((item) => item.disposition === 'priority_review').length,
    review_count: items.filter((item) => item.disposition === 'review').length,
    reference_only_count: items.filter((item) => item.disposition === 'reference_only').length,
    hold_count: items.filter((item) => item.disposition === 'hold').length,
    duplicate_count: items.reduce((count, item) => count + item.duplicate_origin_lead_ids.length, 0),
    official_or_academic_count: items.filter((item) => ['official', 'company_primary', 'academic'].includes(item.source_class)).length,
  };
  return {
    artifact_type: 'research_lead_triage_report',
    schema_version: '1.0.0',
    producer_version: input.producerVersion,
    triage_id: `research_lead_triage_${compactTimestamp(input.generatedAt)}`,
    generated_at: input.generatedAt,
    web_research_id: input.webResearch?.research_id ?? null,
    direct_research_id: input.directResearch?.research_id ?? null,
    input_lead_count: raw.length,
    triaged_lead_count: items.length,
    summary,
    items,
    guardrail_check: {
      input_results_remain_context_only: true,
      no_auto_evidence_import: true,
      evidence_table_required_for_stage: true,
      parent_branch_separation: true,
      no_trading_advice: true,
    },
  };
}

function webLeads(report: WebResearchReport | null): RawLead[] {
  if (!report) return [];
  const queryById = new Map(report.queries.map((query) => [query.query_id, query]));
  return report.leads.map((lead) => fromWebLead(lead, queryById.get(lead.query_id)?.query ?? null, report.generated_at));
}

function fromWebLead(lead: WebResearchLead, query: string | null, retrievedAt: string): RawLead {
  const queryMeta = lead as WebResearchLead & { branch_id?: string | null; candidate_node_id?: string | null };
  return {
    origin: 'web', origin_lead_id: lead.lead_id, topic_id: lead.topic_id,
    branch_id: queryMeta.branch_id ?? null, candidate_node_id: queryMeta.candidate_node_id ?? null,
    title: lead.title, url: lead.url, source_name: lead.source_name, source_domain: lead.source_domain,
    snippet: lead.snippet, published_at: lead.published_at, retrieved_at: lead.retrieved_at || retrievedAt,
    query, source_id: null,
  };
}

function directLeads(report: DirectSourceResearchReport | null): RawLead[] {
  if (!report) return [];
  return report.leads.map((lead) => ({
    origin: 'direct', origin_lead_id: lead.lead_id, topic_id: lead.topic_id, branch_id: lead.branch_id,
    candidate_node_id: lead.candidate_node_id ?? null, title: lead.title, url: lead.url,
    source_name: lead.source_name, source_domain: domainOf(lead.url), snippet: lead.snippet,
    published_at: lead.published_at, retrieved_at: report.generated_at, query: null, source_id: lead.source_id,
  }));
}

function groupByScopeAndUrl(leads: RawLead[]): Map<string, RawLead[]> {
  const groups = new Map<string, RawLead[]>();
  for (const lead of leads) {
    // Scope is part of the key. The same page found for a Branch and Parent
    // remains two separately governed observations, never a parent lift.
    const key = `${lead.topic_id ?? lead.candidate_node_id ?? 'unresolved'}|${lead.branch_id ?? 'parent'}|${canonicalUrl(lead.url)}`;
    const group = groups.get(key) ?? [];
    group.push(lead);
    groups.set(key, group);
  }
  return groups;
}

function triageGroup(leads: RawLead[], input: Parameters<typeof buildResearchLeadTriage>[0]): ResearchLeadTriageItem {
  const ordered = [...leads].sort((left, right) => originWeight(right.origin) - originWeight(left.origin));
  const lead = ordered[0] as RawLead;
  const sourceClass = classifySource(lead, input.sourceAtlas, input.companies);
  const relevance = relevanceFor(lead);
  const freshness = freshnessFor(lead.published_at, input.generatedAt);
  const priorityScore = score({ origin: lead.origin, sourceClass, relevance, freshness });
  const disposition = dispositionFor(sourceClass, relevance, priorityScore);
  const duplicateOriginLeadIds = ordered.slice(1).map((item) => item.origin_lead_id);
  const reasons = reasonsFor({ lead, sourceClass, relevance, freshness, duplicateCount: duplicateOriginLeadIds.length });
  return {
    triage_id: `triage_${shortHash(`${lead.topic_id}|${lead.branch_id}|${canonicalUrl(lead.url)}`)}`,
    origin: lead.origin,
    origin_lead_id: lead.origin_lead_id,
    duplicate_origin_lead_ids: duplicateOriginLeadIds,
    topic_id: lead.topic_id,
    branch_id: lead.branch_id,
    candidate_node_id: lead.candidate_node_id,
    title: lead.title,
    url: lead.url,
    source_name: lead.source_name,
    source_domain: lead.source_domain,
    snippet: lead.snippet,
    published_at: lead.published_at,
    retrieved_at: lead.retrieved_at,
    source_class: sourceClass,
    relevance,
    freshness,
    priority_score: priorityScore,
    priority: priorityScore >= 70 ? 'high' : priorityScore >= 40 ? 'medium' : 'low',
    disposition,
    reasons,
    next_action: nextActionFor(disposition, sourceClass),
    evidence_eligibility: 'context_only',
  };
}

function classifySource(lead: RawLead, atlas: AuthoritativeSourceAtlas, companies: CompanyResearchRegistry): ResearchLeadSourceClass {
  const officialCompanyHosts = companies.companies.map((company) => domainOf(company.official_source_url));
  if (officialCompanyHosts.some((host) => domainMatches(lead.source_domain, host))) return 'company_primary';
  const atlasSource = lead.source_id
    ? atlas.sources.find((source) => source.source_id === lead.source_id)
    : atlas.sources.find((source) => domainMatches(lead.source_domain, domainOf(source.base_url)));
  if (atlasSource) return atlasSource.authority_tier === 'academic' ? 'academic' : 'official';
  const source = `${lead.source_name} ${lead.source_domain}`.toLowerCase();
  if (/(?:sec\.gov|federalregister\.gov|hkexnews\.hk|sse\.com\.cn|szse\.cn|samr\.gov\.cn|nmpa\.gov\.cn|fda\.gov|ema\.europa\.eu|cftc\.gov|eia\.gov|fred\.stlouisfed\.org)/.test(source)) return 'official';
  if (/wikipedia|duckduckgo|archive\.org/.test(source)) return 'reference';
  if (/hacker news|news\.ycombinator|reddit|^r\//.test(source)) return 'community';
  if (/doi\.org|arxiv|openalex|pubmed|nature|lancet|ieee|journal/.test(source)) return 'academic';
  return lead.origin === 'web' ? 'secondary' : 'unknown';
}

function relevanceFor(lead: RawLead): ResearchLeadRelevance {
  if (lead.origin === 'direct') return 'explicit';
  const query = lead.query?.trim();
  if (!query) return 'unverified';
  const title = normalize(lead.title);
  const snippet = normalize(lead.snippet);
  const compactQuery = normalize(query);
  if (compactQuery.length >= 4 && title.includes(compactQuery)) return 'explicit';
  const tokens = query.toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length > 2) ?? [];
  const acronym = (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).map((token) => token[0]).join('');
  if (tokens.length >= 2 && (tokens.every((token) => title.includes(token)) || (acronym.length >= 3 && title.includes(acronym)))) return 'explicit';
  if (compactQuery.length >= 4 && snippet.includes(compactQuery)) return 'contextual';
  if (tokens.length >= 2 && tokens.every((token) => snippet.includes(token))) return 'contextual';
  return 'unverified';
}

function freshnessFor(publishedAt: string | null, generatedAt: string): ResearchLeadFreshness {
  if (!publishedAt || !Number.isFinite(Date.parse(publishedAt))) return 'undated';
  const days = Math.max(0, (Date.parse(generatedAt) - Date.parse(publishedAt)) / 86_400_000);
  if (days <= 90) return 'fresh';
  if (days <= 730) return 'recent';
  return 'archive';
}

function score(input: { origin: ResearchLeadOrigin; sourceClass: ResearchLeadSourceClass; relevance: ResearchLeadRelevance; freshness: ResearchLeadFreshness }): number {
  const sourceScore: Record<ResearchLeadSourceClass, number> = { official: 54, company_primary: 48, academic: 44, secondary: 24, community: 16, reference: 10, unknown: 18 };
  const relevanceScore: Record<ResearchLeadRelevance, number> = { explicit: 24, contextual: 12, unverified: 0 };
  const freshnessScore: Record<ResearchLeadFreshness, number> = { fresh: 14, recent: 7, archive: 0, undated: 0 };
  return Math.min(100, sourceScore[input.sourceClass] + relevanceScore[input.relevance] + freshnessScore[input.freshness] + (input.origin === 'direct' ? 8 : 0));
}

function dispositionFor(sourceClass: ResearchLeadSourceClass, relevance: ResearchLeadRelevance, priorityScore: number): ResearchLeadDisposition {
  if (sourceClass === 'reference') return 'reference_only';
  if (sourceClass === 'community' && relevance !== 'explicit') return 'hold';
  if (relevance === 'unverified') return 'hold';
  if (priorityScore >= 70 && ['official', 'company_primary', 'academic'].includes(sourceClass)) return 'priority_review';
  return 'review';
}

function nextActionFor(disposition: ResearchLeadDisposition, sourceClass: ResearchLeadSourceClass): ResearchLeadTriageItem['next_action'] {
  if (disposition === 'hold') return 'hold';
  if (disposition === 'reference_only') return 'validate_market_name';
  return ['official', 'company_primary'].includes(sourceClass) ? 'review_original' : 'retrieve_primary_source';
}

function reasonsFor(input: { lead: RawLead; sourceClass: ResearchLeadSourceClass; relevance: ResearchLeadRelevance; freshness: ResearchLeadFreshness; duplicateCount: number }): string[] {
  const labels: Record<ResearchLeadSourceClass, string> = { official: '权威来源或受治理披露渠道', company_primary: '公司官网或 IR 页面', academic: '学术或论文索引来源', reference: '参考资料，只用于背景或命名核验', community: '社区/转发线索，需要原始来源核验', secondary: '二级外部线索，需要追溯原始来源', unknown: '来源等级未识别，需要人工判断' };
  const relevance: Record<ResearchLeadRelevance, string> = { explicit: '标题明确复现任务主题', contextual: '摘要复现任务主题，标题需进一步核验', unverified: '未能从可见标题或摘要确认任务主题' };
  const freshness: Record<ResearchLeadFreshness, string> = { fresh: '发布时间在 90 天内', recent: '发布时间在两年内', archive: '历史记录，适合回放或背景核验', undated: '未提供可靠发布时间' };
  const reasons = [labels[input.sourceClass], relevance[input.relevance], freshness[input.freshness]];
  if (input.lead.branch_id) reasons.push('保持分支 scope，不得升级父主题');
  if (input.lead.candidate_node_id) reasons.push('研究种子仅作 provisional 候选，不继承正式主题阶段');
  if (input.duplicateCount) reasons.push(`合并 ${input.duplicateCount} 条同 scope 重复发现记录`);
  return reasons;
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function domainMatches(actual: string, expected: string): boolean {
  return Boolean(actual && expected && (actual === expected || actual.endsWith(`.${expected}`)));
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch { return value.trim().toLowerCase(); }
}

function originWeight(origin: ResearchLeadOrigin): number { return origin === 'direct' ? 2 : 1; }
function compactTimestamp(value: string): string { return value.replace(/[^0-9]/g, '').slice(0, 14); }
function normalize(value: string): string { return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ''); }
function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
