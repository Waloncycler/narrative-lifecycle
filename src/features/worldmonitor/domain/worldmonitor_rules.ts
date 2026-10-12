import type {
  WorldMonitorDomain,
  WorldMonitorEvidenceEligibility,
  WorldMonitorOperationDescriptor,
  WorldMonitorPayload,
  WorldMonitorSignal,
  WorldMonitorSourceConfig,
  WorldMonitorSourceGovernance,
} from '@/features/worldmonitor/types/worldmonitor_adapter';
import {
  normalizedFactsFromWorldMonitorPayload,
  recordsForWorldMonitorPayload,
  recordsFromWorldMonitorPayload,
} from '@/features/worldmonitor/domain/worldmonitor_normalizers';
import { operationSourceConfig, sourceConfigForSourceId } from '@/features/worldmonitor/domain/worldmonitor_source_catalog';
import { isMediaFeedOperation } from '@/features/worldmonitor/domain/worldmonitor_feed_parsing';

export { normalizedFactsFromWorldMonitorPayload, recordsForWorldMonitorPayload, recordsFromWorldMonitorPayload };

const CONTEXT_ONLY = /forecast|prediction|backtest|market-implication|stock-analysis|fear-greed|country.?risk|risk.?score|resilience|simulation/i;
const UNSUPPORTED = /webcam|image|youtube|flight-price|google-flight|webhook|giving|lead/i;

const DIRECT_GOVERNANCE: Record<string, {
  licenseId: string;
  termsUrl: string;
  freshnessHours: number;
}> = {
  USGSSeismology: {
    licenseId: 'us-government-public-domain',
    termsUrl: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits',
    freshnessHours: 24,
  },
  NASAEonet: {
    licenseId: 'nasa-open-data',
    termsUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    freshnessHours: 24,
  },
  NWSAlerts: {
    licenseId: 'us-government-public-domain',
    termsUrl: 'https://www.weather.gov/disclaimer',
    freshnessHours: 1,
  },
  WHODiseaseOutbreakNews: {
    licenseId: 'who-provider-terms',
    termsUrl: 'https://www.who.int/about/policies/publishing/copyright',
    freshnessHours: 168,
  },
  USTreasuryFiscalData: {
    licenseId: 'us-government-public-domain',
    termsUrl: 'https://fiscaldata.treasury.gov/api-documentation/',
    freshnessHours: 48,
  },
  CFTCPublicReporting: {
    licenseId: 'us-government-public-domain',
    termsUrl: 'https://publicreporting.cftc.gov/',
    freshnessHours: 168,
  },
  WorldBankIndicators: {
    licenseId: 'world-bank-dataset-terms',
    termsUrl: 'https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets',
    freshnessHours: 8760,
  },
  GdeltDocArticles: {
    licenseId: 'gdelt-open-data-terms',
    termsUrl: 'https://www.gdeltproject.org/about.html#terms',
    freshnessHours: 24,
  },
  CoinbaseSpotPrice: {
    licenseId: 'coinbase-market-data-terms',
    termsUrl: 'https://www.coinbase.com/legal/market_data',
    freshnessHours: 6,
  },
  EastmoneyConceptBoards: {
    licenseId: 'provider-website-terms',
    termsUrl: 'https://www.eastmoney.com/',
    freshnessHours: 6,
  },
  EastmoneyStockQuote: {
    licenseId: 'provider-website-terms',
    termsUrl: 'https://www.eastmoney.com/',
    freshnessHours: 6,
  },
  ClinicalTrialsGov: {
    licenseId: 'us-government-public-domain',
    termsUrl: 'https://clinicaltrials.gov/data-api/about-api',
    freshnessHours: 168,
  },
  UnComtradePreview: {
    licenseId: 'un-comtrade-public-terms',
    termsUrl: 'https://comtradeapi.un.org/',
    freshnessHours: 168,
  },
  SecEdgarNvidia: {
    licenseId: 'us-government-public-domain',
    termsUrl: 'https://www.sec.gov/os/webmaster-faq',
    freshnessHours: 24,
  },
  SecEdgarApple: {
    licenseId: 'us-government-public-domain',
    termsUrl: 'https://www.sec.gov/os/webmaster-faq',
    freshnessHours: 24,
  },
  SecEdgarTsmc: {
    licenseId: 'us-government-public-domain',
    termsUrl: 'https://www.sec.gov/os/webmaster-faq',
    freshnessHours: 24,
  },
  HackerNewsAlgolia: {
    licenseId: 'algolia-provider-terms',
    termsUrl: 'https://www.algolia.com/policies/terms/',
    freshnessHours: 6,
  },
  AlternativeMeFearGreed: {
    licenseId: 'provider-website-terms',
    termsUrl: 'https://alternative.me/crypto/fear-and-greed-index/',
    freshnessHours: 6,
  },
  CoinGeckoTrending: {
    licenseId: 'coingecko-api-terms',
    termsUrl: 'https://www.coingecko.com/en/terms',
    freshnessHours: 6,
  },

  // Category 8 (v0.8.1+): vendor official blogs, arXiv, open-source and
  // reference feeds plus China government announcement pages.
  OpenAiBlog: {
    licenseId: 'openai-website-terms',
    termsUrl: 'https://openai.com/policies/terms-of-use/',
    freshnessHours: 24,
  },
  OpenAiApiReleases: {
    licenseId: 'github-mit-license',
    termsUrl: 'https://github.com/openai/openai-python',
    freshnessHours: 24,
  },
  DeepMindBlog: {
    licenseId: 'google-website-terms',
    termsUrl: 'https://deepmind.google/about/',
    freshnessHours: 24,
  },
  AppleNewsroom: {
    licenseId: 'apple-website-terms',
    termsUrl: 'https://www.apple.com/legal/internet-services/terms/site.html',
    freshnessHours: 24,
  },
  MetaNews: {
    licenseId: 'meta-website-terms',
    termsUrl: 'https://about.meta.com/terms/',
    freshnessHours: 24,
  },
  AnthropicNews: {
    licenseId: 'anthropic-website-terms',
    termsUrl: 'https://www.anthropic.com/legal/consumer-terms',
    freshnessHours: 24,
  },
  AnthropicReleases: {
    licenseId: 'github-mit-license',
    termsUrl: 'https://github.com/anthropics/anthropic-sdk-python',
    freshnessHours: 24,
  },
  XaiReleases: {
    licenseId: 'xai-open-license',
    termsUrl: 'https://github.com/xai-org/grok-1',
    freshnessHours: 24,
  },
  MicrosoftAiBlog: {
    licenseId: 'microsoft-website-terms',
    termsUrl: 'https://www.microsoft.com/en-us/legal/terms-of-use',
    freshnessHours: 24,
  },
  ArxivPreprints: {
    licenseId: 'arxiv-api-terms',
    termsUrl: 'https://info.arxiv.org/help/api/terms.html',
    freshnessHours: 24,
  },
  HuggingFaceModels: {
    licenseId: 'huggingface-provider-terms',
    termsUrl: 'https://huggingface.co/terms-of-service',
    freshnessHours: 24,
  },
  GithubTrending: {
    licenseId: 'github-api-terms',
    termsUrl: 'https://docs.github.com/en/rest',
    freshnessHours: 24,
  },
  SinaFinance: {
    licenseId: 'provider-website-terms',
    termsUrl: 'https://www.sina.com.cn/',
    freshnessHours: 6,
  },
  '36KrFeed': {
    licenseId: 'provider-website-terms',
    termsUrl: 'https://36kr.com/',
    freshnessHours: 6,
  },
  BbcTech: {
    licenseId: 'bbc-provider-terms',
    termsUrl: 'https://www.bbc.com/usingthebbc/terms/',
    freshnessHours: 6,
  },
  VentureBeat: {
    licenseId: 'provider-website-terms',
    termsUrl: 'https://venturebeat.com/',
    freshnessHours: 6,
  },
  EconomicTimes: {
    licenseId: 'provider-website-terms',
    termsUrl: 'https://economictimes.indiatimes.com/',
    freshnessHours: 6,
  },
  CninfoAnnouncements: {
    licenseId: 'cninfo-provider-terms',
    termsUrl: 'http://www.cninfo.com.cn/',
    freshnessHours: 24,
  },
  GovCnPolicy: {
    licenseId: 'china-government-public-information',
    termsUrl: 'https://www.gov.cn/',
    freshnessHours: 24,
  },
  NdrcNews: {
    licenseId: 'china-government-public-information',
    termsUrl: 'https://www.ndrc.gov.cn/',
    freshnessHours: 24,
  },
  CsrcNews: {
    licenseId: 'china-government-public-information',
    termsUrl: 'http://www.csrc.gov.cn/',
    freshnessHours: 24,
  },
  SseAnnouncements: {
    licenseId: 'provider-website-terms',
    termsUrl: 'http://www.sse.com.cn/',
    freshnessHours: 24,
  },
  SzseAnnouncements: {
    licenseId: 'provider-website-terms',
    termsUrl: 'http://www.szse.cn/',
    freshnessHours: 24,
  },
  YicaiNews: {
    licenseId: 'provider-website-terms',
    termsUrl: 'https://www.yicai.com/',
    freshnessHours: 6,
  },
  CrunchbaseNews: {
    licenseId: 'crunchbase-provider-terms',
    termsUrl: 'https://www.crunchbase.com/',
    freshnessHours: 24,
  },
  BloombergTech: {
    licenseId: 'bloomberg-provider-terms',
    termsUrl: 'https://www.bloomberg.com/legal/terms-of-use',
    freshnessHours: 6,
  },
  ConcordiaResearch: {
    licenseId: 'concordia-website-terms',
    termsUrl: 'https://concordia-ai.com/',
    freshnessHours: 168,
  },
  BrookingsResearch: {
    licenseId: 'brookings-website-terms',
    termsUrl: 'https://www.brookings.edu/',
    freshnessHours: 168,
  },
  MorganStanleyInsights: {
    licenseId: 'morgan-stanley-website-terms',
    termsUrl: 'https://www.morganstanley.com/',
    freshnessHours: 168,
  },
  // --- First Batch (High Value Signals) ---
  DirectHuggingFace: { licenseId: 'huggingface-provider-terms', termsUrl: 'https://huggingface.co/terms', freshnessHours: 24 },
  DirectGithubIssues: { licenseId: 'github-api-terms', termsUrl: 'https://docs.github.com/en/rest', freshnessHours: 24 },
  DirectGithubTrending: { licenseId: 'github-api-terms', termsUrl: 'https://docs.github.com/en/rest', freshnessHours: 24 },
  DirectArxivAi: { licenseId: 'arxiv-api-terms', termsUrl: 'https://info.arxiv.org/help/api/terms.html', freshnessHours: 24 },
  DirectOpenAiNews: { licenseId: 'openai-website-terms', termsUrl: 'https://openai.com/policies/terms-of-use/', freshnessHours: 24 },
  DirectAnthropicNews: { licenseId: 'anthropic-website-terms', termsUrl: 'https://www.anthropic.com/legal/consumer-terms', freshnessHours: 24 },
  DirectDeepseekUpdates: { licenseId: 'deepseek-provider-terms', termsUrl: 'https://www.deepseek.com/', freshnessHours: 24 },
  DirectXaiReleases: { licenseId: 'xai-open-license', termsUrl: 'https://x.ai/', freshnessHours: 24 },
  DirectNdrcPolicy: { licenseId: 'china-government-public-information', termsUrl: 'https://www.ndrc.gov.cn/', freshnessHours: 24 },
  DirectCcgpCentralTenders: { licenseId: 'china-government-public-information', termsUrl: 'http://www.ccgp.gov.cn/', freshnessHours: 24 },
  DirectCcgpCentralAwards: { licenseId: 'china-government-public-information', termsUrl: 'http://www.ccgp.gov.cn/', freshnessHours: 24 },
  DirectStateGridProcurement: { licenseId: 'china-government-public-information', termsUrl: 'http://ecp.sgcc.com.cn/', freshnessHours: 24 },
  DirectNhaDiseaseOutbreaks: { licenseId: 'china-government-public-information', termsUrl: 'http://www.nhc.gov.cn/', freshnessHours: 24 },
  DirectSamrConsumerSafety: { licenseId: 'china-government-public-information', termsUrl: 'http://www.samr.gov.cn/', freshnessHours: 24 },
  DirectMofcomSupplyPrice: { licenseId: 'china-government-public-information', termsUrl: 'http://www.mofcom.gov.cn/', freshnessHours: 24 },
  DirectWeiboHotsearch: { licenseId: 'weibo-provider-terms', termsUrl: 'https://s.weibo.com/', freshnessHours: 6 },
  DirectBaiduHotsearch: { licenseId: 'baidu-provider-terms', termsUrl: 'https://top.baidu.com/', freshnessHours: 6 },
  DirectDouyinPublicHotlist: { licenseId: 'douyin-provider-terms', termsUrl: 'https://www.douyin.com/', freshnessHours: 6 },
  DirectToutiaoHotboard: { licenseId: 'toutiao-provider-terms', termsUrl: 'https://www.toutiao.com/', freshnessHours: 6 },
  DirectBilibiliPopular: { licenseId: 'bilibili-provider-terms', termsUrl: 'https://www.bilibili.com/', freshnessHours: 6 },
  DirectV2exHot: { licenseId: 'v2ex-provider-terms', termsUrl: 'https://www.v2ex.com/', freshnessHours: 6 },
  DirectZhihuOfficialHotlist: { licenseId: 'zhihu-provider-terms', termsUrl: 'https://www.zhihu.com/', freshnessHours: 6 },
  DirectGoogleTrendsUs: { licenseId: 'google-website-terms', termsUrl: 'https://trends.google.com/', freshnessHours: 6 },
  DirectGoogleTrendsHk: { licenseId: 'google-website-terms', termsUrl: 'https://trends.google.com/', freshnessHours: 6 },
  DirectGoogleTrendsTw: { licenseId: 'google-website-terms', termsUrl: 'https://trends.google.com/', freshnessHours: 6 },
  DirectFederalRegister: { licenseId: 'us-government-public-information', termsUrl: 'https://www.federalregister.gov/', freshnessHours: 24 },
  DirectWorldBankGdp: { licenseId: 'worldbank-api-terms', termsUrl: 'https://data.worldbank.org/', freshnessHours: 168 },
  DirectCboeVix: { licenseId: 'cboe-provider-terms', termsUrl: 'https://www.cboe.com/', freshnessHours: 24 },
  DirectCoinbaseMarket: { licenseId: 'coinbase-provider-terms', termsUrl: 'https://www.coinbase.com/legal/user_agreement', freshnessHours: 24 },

  // --- Second Batch (Business Baselines) ---
  Direct36kr: { licenseId: 'provider-website-terms', termsUrl: 'https://36kr.com/', freshnessHours: 6 },
  DirectJiqizhixin: { licenseId: 'provider-website-terms', termsUrl: 'https://www.jiqizhixin.com/', freshnessHours: 6 },
  DirectQbitai: { licenseId: 'provider-website-terms', termsUrl: 'https://www.qbitai.com/', freshnessHours: 6 },
  DirectInfoqCn: { licenseId: 'provider-website-terms', termsUrl: 'https://www.infoq.cn/', freshnessHours: 6 },
  DirectPeopleDailyHeadlines: { licenseId: 'provider-website-terms', termsUrl: 'http://www.people.com.cn/', freshnessHours: 24 },
  DirectCninfoAnnouncements: { licenseId: 'cninfo-provider-terms', termsUrl: 'http://www.cninfo.com.cn/', freshnessHours: 24 },
  DirectSseAnnouncements: { licenseId: 'provider-website-terms', termsUrl: 'http://www.sse.com.cn/', freshnessHours: 24 },
  DirectSzseAnnouncements: { licenseId: 'provider-website-terms', termsUrl: 'http://www.szse.cn/', freshnessHours: 24 },
  Direct1688SearchTrends: { licenseId: 'provider-website-terms', termsUrl: 'https://www.1688.com/', freshnessHours: 24 },
  DirectCsgEnterpriseProcurement: { licenseId: 'china-government-public-information', termsUrl: 'http://www.bidding.csg.cn/', freshnessHours: 24 },

  // --- Third Batch (API Keys required) ---
  DirectAlphaVantageSpy: { licenseId: 'alphavantage-provider-terms', termsUrl: 'https://www.alphavantage.co/', freshnessHours: 24 },
  DirectAlphaVantageQqq: { licenseId: 'alphavantage-provider-terms', termsUrl: 'https://www.alphavantage.co/', freshnessHours: 24 },
  DirectDouyinOfficialHotsearch: { licenseId: 'douyin-provider-terms', termsUrl: 'https://developer.open-douyin.com/', freshnessHours: 6 },
  DirectXOfficialRecentSearch: { licenseId: 'x-provider-terms', termsUrl: 'https://developer.x.com/', freshnessHours: 6 },
  DirectDeepsearchExternalDiscovery: { licenseId: 'provider-website-terms', termsUrl: 'https://github.com/modelcontextprotocol', freshnessHours: 24 },


  // --- Fourth Batch (Phase 4 Expansions) ---
  DirectFedStatements: { licenseId: 'us-government-public-information', termsUrl: 'https://www.federalreserve.gov/', freshnessHours: 24 },
  DirectPbocAnnouncements: { licenseId: 'china-government-public-information', termsUrl: 'http://www.pbc.gov.cn/', freshnessHours: 24 },
  DirectCnipaPatents: { licenseId: 'china-government-public-information', termsUrl: 'https://www.cnipa.gov.cn/', freshnessHours: 24 },
  DirectUsptoPatents: { licenseId: 'us-government-public-information', termsUrl: 'https://www.uspto.gov/', freshnessHours: 24 },
  DirectCpcaAutoSales: { licenseId: 'provider-website-terms', termsUrl: 'http://www.cpcaauto.com/', freshnessHours: 24 },
  DirectBdiIndex: { licenseId: 'balticexchange-provider-terms', termsUrl: 'https://www.balticexchange.com/', freshnessHours: 24 },
  DirectTechGiantsCareers: { licenseId: 'provider-website-terms', termsUrl: 'https://careers.google.com/', freshnessHours: 24 },


};

export function classifyWorldMonitorOperation(input: {
  service: string;
  path: string;
  operationId: string;
}): { domain: WorldMonitorDomain; eligibility: WorldMonitorEvidenceEligibility } {
  const value = `${input.service} ${input.path} ${input.operationId}`;
  const domain: WorldMonitorDomain = /conflict|military|sanction|unrest|displacement/.test(value.toLowerCase())
    ? 'geopolitics'
    : /economic|market|consumer-price|trade|prediction|forecast|resilience|eastmoney|coinbase/.test(value.toLowerCase())
      ? 'financial'
      : /supply-chain|shipping|maritime|energy/.test(value.toLowerCase())
        ? 'energy'
        : /climate|wildfire|natural|seismology|radiation/.test(value.toLowerCase())
          ? 'climate'
          : /health|disease|air-quality|clinical/.test(value.toLowerCase())
            ? 'health'
            : /research|arxiv|hackernews|tech/.test(value.toLowerCase())
                ? 'research'
                : /cyber|infrastructure|aviation/.test(value.toLowerCase())
                  ? 'infrastructure'
                  : /intelligence|news|gdelt|positive-events/.test(value.toLowerCase())
                    ? 'osint'
                    : 'technology';
  const eligibility = UNSUPPORTED.test(value)
    ? 'unsupported'
    : CONTEXT_ONLY.test(value)
      ? 'context_only'
      : 'candidate';
  return { domain, eligibility };
}

export function governanceForWorldMonitorOperation(input: {
  service: string;
  method: string;
  sourceClass: 'direct_public' | 'worldmonitor_hosted';
  eligibility: WorldMonitorEvidenceEligibility;
  productionConfigured: boolean;
}): WorldMonitorSourceGovernance {
  const direct = DIRECT_GOVERNANCE[input.service];
  const sensitivity = /military|intelligence|conflict|aviation|shipping|maritime/i.test(input.service)
    ? 'operational'
    : /social|telegram|reddit|lead/i.test(input.service)
      ? 'potential_pii'
      : 'public';
  const blocked = input.eligibility === 'unsupported';
  const observationWindow = /USGS|Eonet/i.test(input.service)
    ? 'sliding_time'
    : /NWS/i.test(input.service)
      ? 'active_set'
      : /WHO/i.test(input.service)
        ? 'top_n'
        : /Treasury|CFTC|WorldBank/i.test(input.service)
          ? 'time_series'
          : 'unknown';
  const automatedPollingAllowed = input.method === 'GET'
    && !blocked
    && (input.sourceClass === 'direct_public' || input.productionConfigured);
  return {
    source_class: input.sourceClass,
    governance_state: blocked
      ? 'blocked'
      : input.sourceClass === 'worldmonitor_hosted' && !input.productionConfigured
        ? 'review_required'
        : sensitivity === 'operational'
          ? 'review_required'
          : 'research_ready',
    terms_status: input.sourceClass === 'worldmonitor_hosted'
      ? 'entitlement_required'
      : direct?.licenseId.includes('public-domain')
        ? 'public_documented'
        : 'provider_terms_apply',
    license_id: input.sourceClass === 'worldmonitor_hosted'
      ? 'worldmonitor-hosted-service-terms'
      : direct?.licenseId ?? 'provider-terms',
    terms_url: input.sourceClass === 'worldmonitor_hosted'
      ? 'https://www.worldmonitor.app/terms'
      : direct?.termsUrl ?? null,
    attribution_required: true,
    redistribution_allowed: false,
    sensitivity,
    raw_payload_policy: blocked ? 'prohibited' : 'transient_hash_only',
    retention_days: 0,
    freshness_window_hours: direct?.freshnessHours ?? null,
    automated_polling_allowed: automatedPollingAllowed,
    observation_window: observationWindow,
    absence_assertion_allowed: false,
  };
}

export function signalsFromWorldMonitorPayload(payload: WorldMonitorPayload): WorldMonitorSignal[] {
  if (payload.mode !== 'live' || payload.descriptor.evidence_eligibility !== 'candidate') return [];
  return normalizedFactsFromWorldMonitorPayload(payload).map((fact, index) => {
    const upstreamProvenance = provenanceFrom(fact.raw_record);
    return {
      signal_id: `${slug(payload.descriptor.operation_id)}-${fact.upstream_record_id ? slug(fact.upstream_record_id) : index}-${payload.payload_hash.slice(0, 12)}`,
      upstream_record_id: fact.upstream_record_id,
      source_id: slug(payload.descriptor.service),
      operation_id: payload.descriptor.operation_id,
      domain: payload.descriptor.domain,
      timestamp: fact.event_at,
      event_date: fact.event_at.slice(0, 10),
      available_at: fact.available_at,
      event_title: fact.title,
      event_summary: fact.summary,
      event_type: fact.event_type,
      source_name: payload.descriptor.auth_requirement === 'public_no_key'
        ? `Direct public / ${payload.descriptor.service}`
        : `World Monitor / ${payload.descriptor.service}`,
      source_url: fact.source_url,
      location: fact.location,
      metrics: fact.metrics,
      raw_payload: fact.raw_record,
      raw_payload_hash: payload.payload_hash,
      confidence_score: payload.degraded || payload.stale ? 0.35 : 0.6,
      data_mode: payload.mode,
      upstream_provenance: upstreamProvenance,
      source_quote: fact.source_quote,
      normalizer_id: fact.normalizer_id,
      normalizer_version: fact.normalizer_version,
    };
  });
}

export function isDegradedWorldMonitorPayload(body: unknown): boolean {
  return isObject(body) && Boolean(body.degraded || body.upstreamUnavailable || body.partial || body.dataAvailable === false);
}

export function isStaleWorldMonitorPayload(body: unknown): boolean {
  return isObject(body) && Boolean(body.stale);
}

export function sourceConfigForOperation(descriptor: WorldMonitorOperationDescriptor): WorldMonitorSourceConfig {
  const explicit = operationSourceConfig(descriptor.operation_id) ?? sourceConfigForSourceId(slug(descriptor.service));
  if (explicit) return explicit;
  if (isMediaFeedOperation(descriptor.operation_id)) {
    return {
      source_id: slug(descriptor.service),
      source_name: `World Monitor / ${descriptor.service}`,
      domain: descriptor.domain,
      source_type: 'news',
      primary_layer: 'name',
      secondary_layers: ['data_confidence'],
      default_evidence_strength: 'E1',
      default_event_type: 'NEWS_ARTICLE_PUBLISHED',
      default_stage_effect: 'maintain',
      default_polarity: 'neutral',
      default_confidence: 'low',
    };
  }
  const primary = descriptor.domain === 'financial'
    ? 'pricing'
    : descriptor.domain === 'geopolitics'
      ? 'friction'
      : descriptor.domain === 'osint'
        ? 'name'
        : 'reality';
  return {
    source_id: slug(descriptor.service),
    source_name: `World Monitor / ${descriptor.service}`,
    domain: descriptor.domain,
    source_type: 'research',
    primary_layer: primary as WorldMonitorSourceConfig['primary_layer'],
    secondary_layers: ['data_confidence'] as WorldMonitorSourceConfig['secondary_layers'],
    default_evidence_strength: 'E1',
    default_event_type: screamingSnake(descriptor.operation_id),
    default_stage_effect: 'maintain',
    default_polarity: 'neutral',
    default_confidence: 'low',
  };
}

function provenanceFrom(record: Record<string, unknown>): string[] {
  return ['source', 'sourceUrl', 'url', 'ItemDefaultUrl', 'provider', 'authority']
    .map((key) => record[key])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function slug(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function screamingSnake(value: string): string {
  return slug(value).toUpperCase();
}
