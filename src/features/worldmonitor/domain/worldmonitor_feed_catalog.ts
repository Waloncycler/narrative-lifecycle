import type { WorldMonitorSourceConfig } from '@/features/worldmonitor/types/worldmonitor_adapter';

/**
 * Feed-style source lifecycle mapping catalog (v0.8.1+).
 *
 * Vendor official blogs, arXiv, open-source hubs, media feeds, government
 * news pages and research portals are structurally different from the
 * OpenAPI-hosted sources in worldmonitor_source_catalog.ts, so their
 * lifecycle configuration lives here. The resolution functions in
 * worldmonitor_source_catalog.ts consult both tables, keeping every file
 * under the 500-line discipline.
 *
 * These entries share one normalizer family (worldmonitor_feed_parsing.ts)
 * and remain candidate-only: import, Topic/Branch assignment and Stage/Score
 * changes are still human-gated by the intake review pipeline.
 */

function feed(
  source_id: string,
  source_name: string,
  domain: WorldMonitorSourceConfig['domain'],
  source_type: WorldMonitorSourceConfig['source_type'],
  primary_layer: WorldMonitorSourceConfig['primary_layer'],
  secondary_layers: WorldMonitorSourceConfig['secondary_layers'],
  default_evidence_strength: WorldMonitorSourceConfig['default_evidence_strength'],
  default_event_type: string,
  default_stage_effect: WorldMonitorSourceConfig['default_stage_effect'],
  default_polarity: WorldMonitorSourceConfig['default_polarity'],
  default_confidence: WorldMonitorSourceConfig['default_confidence'],
): WorldMonitorSourceConfig {
  return {
    source_id,
    source_name,
    domain,
    source_type,
    primary_layer,
    secondary_layers,
    default_evidence_strength,
    default_event_type,
    default_stage_effect,
    default_polarity,
    default_confidence,
  };
}

const vendor = (id: string, name: string, domain: WorldMonitorSourceConfig['domain'] = 'research') => feed(
  id,
  name,
  domain,
  'official',
  'name',
  ['reality'],
  'E3',
  'OFFICIAL_ANNOUNCEMENT',
  'watch_upgrade',
  'neutral',
  'medium',
);

const media = (id: string, name: string, domain: WorldMonitorSourceConfig['domain']) => feed(
  id,
  name,
  domain,
  'news',
  'name',
  ['momentum'],
  'E1',
  'NEWS_ARTICLE_PUBLISHED',
  'maintain',
  'neutral',
  'low',
);

const gov = (id: string, name: string, domain: WorldMonitorSourceConfig['domain']) => feed(
  id,
  name,
  domain,
  'official',
  'friction',
  ['reality'],
  'E3',
  'OFFICIAL_GOV_ANNOUNCEMENT',
  'watch_upgrade',
  'neutral',
  'high',
);

const researchInstitute = (id: string, name: string, domain: WorldMonitorSourceConfig['domain']) => feed(
  id,
  name,
  domain,
  'research',
  'data_confidence',
  ['name'],
  'E2',
  'RESEARCH_REPORT_PUBLISHED',
  'maintain',
  'neutral',
  'low',
);

export const FEED_SOURCE_CATALOG: Record<string, WorldMonitorSourceConfig> = {
  // 原始数据源：厂商官方博客 / Release Notes
  openai_blog: vendor('openai_blog', 'OpenAI 官方博客'),
  openai_api_releases: vendor('openai_api_releases', 'OpenAI API/SDK Release Notes'),
  deepmind_blog: vendor('deepmind_blog', 'Google DeepMind 官方博客'),
  apple_newsroom: vendor('apple_newsroom', 'Apple 官方 Newsroom', 'technology'),
  meta_news: vendor('meta_news', 'Meta 官方新闻'),
  anthropic_news: vendor('anthropic_news', 'Anthropic 官方新闻'),
  anthropic_releases: vendor('anthropic_releases', 'Anthropic Release Notes'),
  xai_releases: vendor('xai_releases', 'xAI 官方发布'),
  microsoft_ai_blog: vendor('microsoft_ai_blog', 'Microsoft 官方 AI 博客'),

  // 原始数据源：学术与政府官方公告
  arxiv_preprints: feed('arxiv_preprints', 'arXiv 预印本 (cs.AI/cs.CL/cs.LG/cs.CR)', 'research', 'academic', 'reality', ['name'], 'E2', 'PREPRINT_PUBLISHED', 'watch_upgrade', 'neutral', 'medium'),
  govcn_policy: gov('govcn_policy', '中国政府网 政策文件', 'geopolitics'),
  ndrc_news: gov('ndrc_news', '国家发改委 新闻发布', 'financial'),
  csrc_news: gov('csrc_news', '中国证监会 公告', 'financial'),
  sse_announcements: gov('sse_announcements', '上交所 公告', 'financial'),
  szse_announcements: gov('szse_announcements', '深交所 公告', 'financial'),
  cninfo_announcements: feed('cninfo_announcements', '巨潮资讯网 A股公告', 'financial', 'official', 'reality', ['friction'], 'E2', 'OFFICIAL_ANNOUNCEMENT', 'watch_upgrade', 'neutral', 'medium'),

  // 引用数据源：科技媒体与行业数据库
  bbc_tech: media('bbc_tech', 'BBC Technology', 'technology'),
  venturebeat_news: media('venturebeat_news', 'VentureBeat', 'technology'),
  kr36_feed: media('kr36_feed', '36氪', 'technology'),
  economic_times: media('economic_times', 'Economic Times', 'financial'),
  sina_finance: media('sina_finance', '新浪财经', 'financial'),
  yicai_news: media('yicai_news', '第一财经', 'financial'),
  crunchbase_news: media('crunchbase_news', 'Crunchbase News 行业数据库', 'financial'),
  bloomberg_tech: media('bloomberg_tech', 'Bloomberg Technology', 'financial'),

  // 引用数据源：开源社区与行业研究报告
  huggingface_models: feed('huggingface_models', 'Hugging Face 模型库', 'research', 'other', 'reality', ['name', 'momentum'], 'E1', 'OPEN_SOURCE_MODEL', 'watch_upgrade', 'neutral', 'medium'),
  github_trending: feed('github_trending', 'GitHub 热门仓库', 'technology', 'other', 'reality', ['name'], 'E1', 'OPEN_SOURCE_REPO', 'maintain', 'neutral', 'low'),
  concordia_research: researchInstitute('concordia_research', 'Concordia AI 政策研究', 'research'),
  brookings_research: researchInstitute('brookings_research', 'Brookings Institution 研究', 'research'),
  morgan_stanley_insights: researchInstitute('morgan_stanley_insights', 'Morgan Stanley 行业研究', 'financial'),
};

export const FEED_OPERATION_TO_SOURCE_ID: Record<string, string> = {
  DirectOpenAiBlog: 'openai_blog',
  DirectOpenAiApiReleases: 'openai_api_releases',
  DirectDeepMindBlog: 'deepmind_blog',
  DirectAppleNewsroom: 'apple_newsroom',
  DirectMetaNews: 'meta_news',
  DirectAnthropicNews: 'anthropic_news',
  DirectAnthropicReleases: 'anthropic_releases',
  DirectXaiReleases: 'xai_releases',
  DirectMicrosoftAiBlog: 'microsoft_ai_blog',
  DirectArxivPreprints: 'arxiv_preprints',
  DirectBbcTech: 'bbc_tech',
  DirectVentureBeat: 'venturebeat_news',
  Direct36KrFeed: 'kr36_feed',
  DirectEconomicTimes: 'economic_times',
  DirectSinaFinance: 'sina_finance',
  DirectYicaiNews: 'yicai_news',
  DirectCrunchbaseNews: 'crunchbase_news',
  DirectHuggingFaceModels: 'huggingface_models',
  DirectGithubTrending: 'github_trending',
  DirectGovCnPolicy: 'govcn_policy',
  DirectNdrcNews: 'ndrc_news',
  DirectCsrcNews: 'csrc_news',
  DirectSseAnnouncements: 'sse_announcements',
  DirectSzseAnnouncements: 'szse_announcements',
  DirectBloombergTech: 'bloomberg_tech',
  DirectConcordiaResearch: 'concordia_research',
  DirectBrookingsResearch: 'brookings_research',
  DirectMorganStanleyInsights: 'morgan_stanley_insights',
  DirectCninfoAnnouncements: 'cninfo_announcements',
};

export const FEED_SOURCE_IDS = Object.keys(FEED_SOURCE_CATALOG);
