import type { AcquisitionTask, GateName } from '@/features/research/domain/evidence_gate_coverage';
import type { AuthoritativeResearchSource, AuthoritativeSourceAtlas, CompanyResearchRegistry, ResearchCoverageLayer } from '@/features/research/types/research_coverage';

export interface GateAcquisitionQuery {
  query: string;
  source_ids: string[];
  source_domains: string[];
  strict_source_domains: string[];
  strategy: 'broad_discovery' | 'authoritative_domain';
  target_layer: ResearchCoverageLayer;
}

const MARKET_NAMING_SOURCES = [
  { source_id: 'eastmoney_concepts', domain: 'data.eastmoney.com' },
  { source_id: 'tonghuashun_concepts', domain: '10jqka.com.cn' },
];

const GATE_TERMS: Record<GateName, string> = {
  stable_label: '概念板块 行业分类 指数 ETF 基金名称 研报标题 稳定命名',
  capital: '融资 定增 IPO 基金持仓 资本开支 投资额 领投方 官方披露',
  pricing: '一致预期 估值方法 收入预测 指数估值 定价 可比公司 官方数据',
  hard_reality: '监管批文 中标 合同 出货量 产能 收入确认 采购项目 官方原文',
};

const GATE_SOURCE_PRIORITY: Record<GateName, string[]> = {
  stable_label: ['eastmoney_concepts', 'tonghuashun_concepts', 'wipo', 'crossref', 'openalex'],
  capital: ['cninfo', 'sse_disclosures', 'hkexnews', 'sec_edgar', 'usaspending', 'csrc'],
  pricing: ['fred', 'nbs_china', 'eia', 'world_bank', 'bis', 'eurostat', 'un_comtrade', 'ggii'],
  hard_reality: ['gov_cn', 'miit', 'ndrc', 'nmpa', 'cde', 'openfda', 'clinicaltrials', 'cninfo', 'sec_edgar', 'usaspending'],
};

/** Converts a gate gap into broad and authority-constrained searches. Search
 * remains discovery-only; this strategy cannot create Evidence or Stage. */
export function buildGateAcquisitionQueries(input: {
  task: AcquisitionTask;
  atlas: AuthoritativeSourceAtlas;
  companies?: CompanyResearchRegistry;
  limit: number;
}): GateAcquisitionQuery[] {
  const limit = Math.max(1, input.limit);
  const targetLayer = coverageLayer(input.task.layer);
  const ranked = rankedSources(input.task, input.atlas);
  const companies = relevantCompanySources(input.task, input.companies);
  const sources = ranked.length ? [ranked[0]!, ...companies, ...ranked.slice(1)] : companies;
  const excluded = input.task.existing_source_domains.slice(0, 2).map((domain) => `-site:${domain}`).join(' ');
  const base = `"${input.task.topic_name}" ${GATE_TERMS[input.task.gate]}`;
  const queries: GateAcquisitionQuery[] = [{
    query: `${base} ${excluded}`.trim(),
    source_ids: [], source_domains: [], strict_source_domains: [],
    strategy: 'broad_discovery', target_layer: targetLayer,
  }];
  for (const source of sources) {
    if (queries.length >= limit) break;
    const domain = sourceDomain(source);
    if (!domain || input.task.existing_source_domains.includes(domain)) continue;
    queries.push({
      query: `${base} site:${domain}`,
      source_ids: [source.source_id], source_domains: [domain], strict_source_domains: [domain],
      strategy: 'authoritative_domain', target_layer: targetLayer,
    });
  }
  return queries;
}

function relevantCompanySources(task: AcquisitionTask, registry: CompanyResearchRegistry | undefined): AuthoritativeResearchSource[] {
  if (!registry || task.gate === 'stable_label') return [];
  return registry.companies
    .filter((company) => company.coverage_node_ids.includes(task.topic_id))
    .map((company) => ({
      source_id: `company_${company.company_id}`,
      display_name_zh: company.display_name_zh,
      display_name_en: company.display_name_en,
      operator: company.display_name_en,
      authority_tier: 'company' as const,
      domains: ['cross_industry'],
      coverage_layers: [coverageLayer(task.layer)],
      access_mode: 'search_bridge' as const,
      base_url: company.official_source_url,
      terms_url: company.official_source_url,
      automated_polling_allowed: false,
      review_required: true,
      evidence_ceiling: 'E2' as const,
      topic_discovery_capable: false,
      branch_discovery_capable: true,
      languages: ['zh', 'en'],
    }));
}

function rankedSources(task: AcquisitionTask, atlas: AuthoritativeSourceAtlas): AuthoritativeResearchSource[] {
  const virtual = task.gate === 'stable_label'
    ? MARKET_NAMING_SOURCES.map((item) => virtualSource(item.source_id, item.domain))
    : [];
  const topicDomain = inferTopicDomain(task.topic_name);
  const targetLayer = coverageLayer(task.layer);
  const candidates = atlas.sources.filter((source) => source.coverage_layers.includes(targetLayer)
    && (source.domains.includes(topicDomain) || source.domains.includes('cross_industry') || topicDomain === 'cross_industry'));
  const priority = GATE_SOURCE_PRIORITY[task.gate];
  return [...virtual, ...candidates].sort((left, right) => {
    const leftRank = priority.indexOf(left.source_id);
    const rightRank = priority.indexOf(right.source_id);
    return (leftRank < 0 ? 999 : leftRank) - (rightRank < 0 ? 999 : rightRank)
      || authorityWeight(right) - authorityWeight(left)
      || left.source_id.localeCompare(right.source_id);
  });
}

function coverageLayer(layer: AcquisitionTask['layer']): ResearchCoverageLayer {
  if (layer === 'perception') return 'name';
  if (layer === 'capital' || layer === 'pricing' || layer === 'reality' || layer === 'friction') return layer;
  return 'reality';
}

function inferTopicDomain(name: string): string {
  if (/药|医疗|医药|生物|临床|疫苗|health|pharma|biotech/i.test(name)) return 'health';
  if (/电池|能源|储能|光伏|风电|氢能|核能|energy|battery|solar/i.test(name)) return 'energy';
  if (/银行|金融|消费|地产|经济|证券|资产|finance|bank|consumer/i.test(name)) return 'financial';
  if (/航天|航空|卫星|space|aerospace/i.test(name)) return 'aerospace';
  if (/AI|机器人|半导体|算力|软件|量子|智能|芯片|区块链|technology|robot|semiconductor/i.test(name)) return 'technology';
  return 'cross_industry';
}

function authorityWeight(source: AuthoritativeResearchSource): number {
  return ({ statutory: 7, regulator: 6, filing: 5, intergovernmental: 4, company: 3, academic: 2, news: 1 } as Record<string, number>)[source.authority_tier] ?? 0;
}

function sourceDomain(source: AuthoritativeResearchSource): string {
  try { return new URL(source.base_url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function virtualSource(sourceId: string, domain: string): AuthoritativeResearchSource {
  return {
    source_id: sourceId, display_name_zh: sourceId, display_name_en: sourceId, operator: sourceId,
    authority_tier: 'news', domains: ['cross_industry'], coverage_layers: ['name'], access_mode: 'search_bridge',
    base_url: `https://${domain}/`, terms_url: `https://${domain}/`, automated_polling_allowed: false,
    review_required: true, evidence_ceiling: 'E1', topic_discovery_capable: true, branch_discovery_capable: false, languages: ['zh'],
  };
}
