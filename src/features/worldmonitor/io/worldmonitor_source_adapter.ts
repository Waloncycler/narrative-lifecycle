import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  classifyWorldMonitorOperation,
  governanceForWorldMonitorOperation,
  isDegradedWorldMonitorPayload,
  isStaleWorldMonitorPayload,
} from '@/features/worldmonitor/domain/worldmonitor_rules';
import { normalizerIdForOperation } from '@/features/worldmonitor/domain/worldmonitor_normalizers';
import type {
  WorldMonitorOperationDescriptor,
  WorldMonitorPayload,
  WorldMonitorFactState,
  WorldMonitorSourceInventory,
  WorldMonitorSyncMode,
} from '@/features/worldmonitor/types/worldmonitor_adapter';
import { writeGenericArtifact } from '@/platform/io/run_manifest_writer';

interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Array<{ name?: string; required?: boolean }>;
}

interface OpenApiDocument {
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

interface SandboxIndex {
  operations?: Array<{
    operationId: string;
    fixture: string;
    productionUrl: string;
  }>;
}

const DIRECT_PUBLIC_OPERATIONS: WorldMonitorOperationDescriptor[] = [
  direct('DirectUSGSEarthquakes', 'USGSSeismology', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson', 'climate', 'candidate', 'USGS magnitude 4.5+ weekly earthquake feed'),
  direct('DirectNASAEonetEvents', 'NASAEonet', 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=100', 'climate', 'candidate', 'NASA EONET open natural events'),
  direct('DirectGDACSEvents', 'GDACS', 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP', 'climate', 'candidate', 'GDACS disaster event list'),
  direct('DirectNWSAlerts', 'NWSAlerts', 'https://api.weather.gov/alerts/active?status=actual&message_type=alert', 'climate', 'candidate', 'US National Weather Service active alerts'),
  direct('DirectWHODiseaseOutbreaks', 'WHODiseaseOutbreakNews', 'https://www.who.int/api/emergencies/diseaseoutbreaknews?sf_provider=dynamicProvider372&sf_culture=en&$orderby=PublicationDateAndTime%20desc&$select=Title,ItemDefaultUrl,PublicationDateAndTime&$top=30', 'health', 'candidate', 'WHO Disease Outbreak News'),
  direct('DirectUSTreasuryDebt', 'USTreasuryFiscalData', 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?fields=record_date,tot_pub_debt_out_amt&sort=-record_date&page%5Bsize%5D=5', 'financial', 'candidate', 'US Treasury debt to the penny'),
  direct('DirectCFTCCotFinancial', 'CFTCPublicReporting', 'https://publicreporting.cftc.gov/resource/yw9f-hn96.json?$limit=50&$order=report_date_as_yyyy_mm_dd%20DESC', 'financial', 'context_only', 'CFTC financial futures positioning'),
  direct('DirectWorldBankGDP', 'WorldBankIndicators', 'https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&per_page=100&date=2024', 'financial', 'context_only', 'World Bank GDP indicator snapshot'),
  direct('DirectGdeltDocArticles', 'GdeltDocArticles', 'https://api.gdeltproject.org/api/v2/doc/doc?query=world&mode=artlist&maxrecords=25&format=json&sort=datedesc', 'osint', 'candidate', 'GDELT DOC 2.0 global news articles'),
  direct('DirectCoinbaseSpotPrice', 'CoinbaseSpotPrice', 'https://api.coinbase.com/v2/prices/BTC-USD/spot', 'financial', 'candidate', 'Coinbase public spot price quote (BTC-USD)'),
  direct('DirectEastmoneyConceptBoards', 'EastmoneyConceptBoards', 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=25&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m%3A90%2Bt%3A3&fields=f12%2Cf14%2Cf2%2Cf3%2Cf4%2Cf6%2Cf8%2Cf10%2Cf20', 'financial', 'candidate', 'A-share concept board ranking (Eastmoney)'),
  direct('DirectEastmoneyStockQuote', 'EastmoneyStockQuote', 'https://push2.eastmoney.com/api/qt/stock/get?secid=1.688981&fltt=2&invt=2&fields=f43%2Cf44%2Cf45%2Cf46%2Cf47%2Cf48%2Cf57%2Cf58%2Cf169%2Cf170', 'financial', 'candidate', 'A-share stock quote (Eastmoney)'),
  direct('DirectClinicalTrialsGovStudies', 'ClinicalTrialsGov', 'https://clinicaltrials.gov/api/v2/studies?query.term=cancer&pageSize=5&sort=LastUpdatePostDate%3Adesc', 'health', 'candidate', 'US NIH ClinicalTrials.gov recently updated studies'),
  direct('DirectUnComtradePreview', 'UnComtradePreview', 'https://comtradeapi.un.org/public/v1/preview/C/A/HS?period=2024&reporterCode=156&cmdCode=8549&partnerCode=0', 'financial', 'candidate', 'UN Comtrade public preview trade flows'),
  direct('DirectSecEdgarNvidia', 'SecEdgarNvidia', 'https://data.sec.gov/submissions/CIK0001045810.json', 'financial', 'candidate', 'NVIDIA official SEC EDGAR submissions'),
  direct('DirectSecEdgarApple', 'SecEdgarApple', 'https://data.sec.gov/submissions/CIK0000320193.json', 'financial', 'candidate', 'Apple official SEC EDGAR submissions'),
  direct('DirectSecEdgarTsmc', 'SecEdgarTsmc', 'https://data.sec.gov/submissions/CIK0001046179.json', 'financial', 'candidate', 'TSMC official SEC EDGAR submissions'),
  direct('DirectHackerNewsStories', 'HackerNewsAlgolia', 'https://hn.algolia.com/api/v1/search?query=robotics%20OR%20AI%20OR%20semiconductor%20OR%20biotech&tags=story&hitsPerPage=15', 'research', 'candidate', 'Hacker News developer community signal (Algolia search)'),
  direct('DirectFearGreedIndex', 'AlternativeMeFearGreed', 'https://api.alternative.me/fng/?limit=14', 'financial', 'candidate', 'Crypto Fear & Greed market sentiment index'),
  direct('DirectCoinGeckoTrending', 'CoinGeckoTrending', 'https://api.coingecko.com/api/v3/search/trending', 'financial', 'candidate', 'CoinGecko trending market search signal'),

  // Category 8: vendor official blog feeds (RSS/Atom), arXiv preprints, and
  // industry/reference signals (v0.9.0+)
  direct('DirectOpenAiBlog', 'OpenAiBlog', 'https://openai.com/news/rss.xml', 'research', 'candidate', 'OpenAI official blog and announcements'),
  direct('DirectDeepMindBlog', 'DeepMindBlog', 'https://deepmind.google/blog/rss.xml', 'research', 'candidate', 'Google DeepMind official blog'),
  direct('DirectAppleNewsroom', 'AppleNewsroom', 'https://www.apple.com/newsroom/rss-feed.rss', 'technology', 'candidate', 'Apple official newsroom'),
  direct('DirectMetaNews', 'MetaNews', 'https://about.fb.com/news/feed/', 'research', 'candidate', 'Meta official company news'),
  direct('DirectArxivPreprints', 'ArxivPreprints', 'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG+OR+cat:cs.CR&sortBy=submittedDate&sortOrder=descending&max_results=20', 'research', 'candidate', 'arXiv preprints (cs.AI, cs.CL, cs.LG, cs.CR)'),
  direct('DirectHuggingFaceModels', 'HuggingFaceModels', 'https://huggingface.co/api/models?sort=downloads&limit=15&full=false', 'research', 'candidate', 'Hugging Face most-downloaded models'),
  direct('DirectGithubTrending', 'GithubTrending', 'https://api.github.com/search/repositories?q=LLM+OR+AI+OR+robotics&sort=stars&order=desc&per_page=10', 'technology', 'candidate', 'GitHub starred repositories (AI/LLM/robotics)'),
  direct('DirectSinaFinance', 'SinaFinance', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&num=15&page=1', 'financial', 'candidate', 'Sina Finance rolling news stream'),
  direct('Direct36KrFeed', '36KrFeed', 'https://36kr.com/feed', 'technology', 'candidate', '36Kr Chinese tech news feed'),
  direct('DirectBbcTech', 'BbcTech', 'https://feeds.bbci.co.uk/news/technology/rss.xml', 'technology', 'candidate', 'BBC technology news'),
  direct('DirectVentureBeat', 'VentureBeat', 'https://venturebeat.com/feed/', 'technology', 'candidate', 'VentureBeat AI/tech news'),
  direct('DirectEconomicTimes', 'EconomicTimes', 'https://economictimes.indiatimes.com/rssfeeds/1977021501.cms', 'financial', 'candidate', 'Economic Times tech news'),
  direct('DirectCninfoAnnouncements', 'CninfoAnnouncements', 'http://www.cninfo.com.cn/new/hisAnnouncement/query', 'financial', 'candidate', 'CNINFO A-share listed company official announcements', {
    method: 'POST',
    post_body: 'pageNum=1&pageSize=15&column=szse&tabName=fulltext&isHLtitle=true',
    content_type: 'application/x-www-form-urlencoded',
  }),

  // Category 8 (v0.8.1+): more vendor official releases and Release Notes.
  // Anthropic / xAI / OpenAI do not expose RSS for their news hubs, so their
  // official GitHub release feeds (Atom) are used; HTML scraping covers the
  // remaining server-rendered official pages (see worldmonitor_feed_parsing).
  direct('DirectOpenAiApiReleases', 'OpenAiApiReleases', 'https://github.com/openai/openai-python/releases.atom', 'research', 'candidate', 'OpenAI API/SDK official release notes (GitHub Atom)'),
  direct('DirectAnthropicReleases', 'AnthropicReleases', 'https://github.com/anthropics/anthropic-sdk-python/releases.atom', 'research', 'candidate', 'Anthropic official release notes (GitHub Atom)'),
  direct('DirectAnthropicNews', 'AnthropicNews', 'https://www.anthropic.com/news', 'research', 'candidate', 'Anthropic official news hub (HTML scrape)'),
  direct('DirectXaiReleases', 'XaiReleases', 'https://github.com/xai-org/grok-1/releases.atom', 'research', 'candidate', 'xAI official releases (GitHub Atom)'),
  direct('DirectMicrosoftAiBlog', 'MicrosoftAiBlog', 'https://blogs.microsoft.com/feed/', 'research', 'candidate', 'Microsoft official blog feed (AI announcements)'),
  direct('DirectGovCnPolicy', 'GovCnPolicy', 'https://www.gov.cn/zhengce/', 'geopolitics', 'candidate', 'China State Council latest policy documents (HTML scrape)'),
  direct('DirectNdrcNews', 'NdrcNews', 'https://www.ndrc.gov.cn/xwdt/', 'financial', 'candidate', 'China NDRC news release list (HTML scrape)'),
  direct('DirectCsrcNews', 'CsrcNews', 'http://www.csrc.gov.cn/csrc/c100028/common_list.shtml', 'financial', 'candidate', 'China CSRC regulator announcements (HTML scrape)'),
  // SSE/SZSE pages are JS-rendered; their data APIs are used instead. SSE is a
  // JSON GET (Referer required), SZSE is a JSON-body POST (anti-scrape headers).
  direct('DirectSseAnnouncements', 'SseAnnouncements', 'http://query.sse.com.cn/security/stock/queryCompanyBulletin.do?isPagination=false&securityType=0101%2C120100%2C020100%2C020200%2C120200&reportType2=DQBG&reportType=ALL&beginDate=&endDate=', 'financial', 'candidate', 'Shanghai Stock Exchange announcement query (JSON API)', {
    headers: { Referer: 'http://www.sse.com.cn/disclosure/listedinfo/announcement/' },
  }),
  direct('DirectSzseAnnouncements', 'SzseAnnouncements', 'https://www.szse.cn/api/disc/announcement/annList?random=0.7331', 'financial', 'candidate', 'Shenzhen Stock Exchange notice list (JSON API)', {
    method: 'POST',
    post_body: '{"channelCode":["listedNotice_disc"],"bigCategoryId":["010301"],"pageSize":20,"pageNum":1}',
    content_type: 'application/json',
    headers: {
      Referer: 'http://www.szse.cn/disclosure/listed/notice/index.html',
      Origin: 'http://www.szse.cn',
      'X-Request-Type': 'ajax',
      'X-Requested-With': 'XMLHttpRequest',
    },
  }),
  direct('DirectYicaiNews', 'YicaiNews', 'https://www.yicai.com/news/', 'financial', 'candidate', 'Yicai first financial news list (HTML scrape)'),
  direct('DirectCrunchbaseNews', 'CrunchbaseNews', 'https://news.crunchbase.com/feed/', 'financial', 'candidate', 'Crunchbase News industry database feed'),
  direct('DirectBloombergTech', 'BloombergTech', 'https://www.bloomberg.com/feeds/technology/news.rss', 'financial', 'candidate', 'Bloomberg Technology official RSS feed'),
  direct('DirectConcordiaResearch', 'ConcordiaResearch', 'https://concordia-ai.com/feed/', 'research', 'candidate', 'Concordia AI policy research feed (WordPress RSS)'),
  direct('DirectBrookingsResearch', 'BrookingsResearch', 'https://www.brookings.edu/research/', 'research', 'candidate', 'Brookings Institution research articles (HTML scrape)'),
  direct('DirectMorganStanleyInsights', 'MorganStanleyInsights', 'https://www.morganstanley.com/ideas', 'financial', 'candidate', 'Morgan Stanley Insights research (HTML scrape)'),
  
  // Category 9 (v0.9.5+): Elite Institutional, Financial & Macro Data Sources
  direct('DirectCailianTelegraph', 'CailianTelegraph', 'https://www.cls.cn/nodeapi/telegraphList', 'financial', 'candidate', 'Cailian Press (财联社) 24/7 Rolling Telegraph'),
  direct('DirectWSJBusiness', 'WSJBusiness', 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml', 'financial', 'candidate', 'The Wall Street Journal - Global Business & Markets RSS'),
  direct('DirectReutersBiz', 'ReutersBiz', 'https://www.reutersagency.com/feed/', 'geopolitics', 'candidate', 'Reuters Business & Finance Wire'),
  direct('DirectTechCrunch', 'TechCrunch', 'https://techcrunch.com/feed/', 'technology', 'candidate', 'TechCrunch Startups and VC News'),
  direct('DirectWindMacro', 'WindMacro', 'https://api.wind.com.cn/v1/macro/news', 'financial', 'candidate', 'Wind Data (万得) Macro Market News API'),
  direct('DirectCICCResearch', 'CICCResearch', 'https://research.cicc.com/api/reports', 'research', 'candidate', 'CICC (中金公司) Institutional Research Reports'),

  // Category 10 (v0.9.6+): NewTimeSpace Premium Regional Intel
  direct('DirectNtsFinance', 'NtsFinance', 'https://www.newtimespace.com/feed/rss_template.xml?id=100000&site=rss&lang=zh-cn', 'financial', 'candidate', 'NewTimeSpace Finance (新时空-财经) RSS'),
  direct('DirectNtsTechnology', 'NtsTechnology', 'https://www.newtimespace.com/feed/rss_template.xml?id=100003&site=rss&lang=zh-cn', 'technology', 'candidate', 'NewTimeSpace Technology (新时空-科技) RSS'),
  direct('DirectNtsEtf', 'NtsEtf', 'https://www.newtimespace.com/feed/rss_template.xml?id=100002&site=rss&lang=zh-cn', 'financial', 'candidate', 'NewTimeSpace ETF (新时空-ETF) RSS'),
  direct('DirectNtsResearch', 'NtsResearch', 'https://www.newtimespace.com/feed/rss_template.xml?id=200097&site=rss&lang=zh-cn', 'research', 'candidate', 'NewTimeSpace Research (新时空研究院) RSS'),

  // Category 11 (v0.9.7+): Investing.com Premium Macro & Capital
  direct('DirectInvestingMacro', 'InvestingMacro', 'https://cn.investing.com/rss/news_14.rss', 'financial', 'candidate', 'Investing.com Macro & Market News (宏观与市场资讯)'),
  direct('DirectInvestingStock', 'InvestingStock', 'https://cn.investing.com/rss/news_25.rss', 'financial', 'candidate', 'Investing.com Stock Market News (股票股市资讯)'),
  direct('DirectInvestingAnalysis', 'InvestingAnalysis', 'https://cn.investing.com/rss/market_overview.rss', 'research', 'candidate', 'Investing.com Market Overview Analysis (市场概况分析)'),
  direct('DirectInvestingCrypto', 'InvestingCrypto', 'https://cn.investing.com/rss/news_301.rss', 'financial', 'candidate', 'Investing.com Crypto News (虚拟货币最新消息)'),

  // Category 12 (v0.9.8+): TradingView Top News Providers
  direct('DirectBusinessWire', 'BusinessWire', 'https://feed.businesswire.com/mrss/home/?rss=G1QFDERJXkJcFVJYWQ%3D%3D', 'financial', 'candidate', 'BusinessWire global corporate press release wire (MRSS)'),
  direct('DirectGelonghui', 'Gelonghui', 'https://www.gelonghui.com/api/channels/web_home_page/articles/v8', 'financial', 'candidate', 'Gelonghui (格隆汇) financial news API'),
  direct('DirectPANews', 'PANews', 'https://www.panewslab.com/rss.xml', 'financial', 'candidate', 'PANews crypto & Web3 news RSS'),
  direct('DirectFx168', 'Fx168', 'https://www.fx168news.com/info/001001', 'financial', 'candidate', 'FX168 财经网 要闻 market news list (HTML scrape)'),
  direct('DirectGlobeNewswire', 'GlobeNewswire', 'https://www.globenewswire.com/RssFeed/category/en/ALL', 'financial', 'candidate', 'GlobeNewswire corporate press release RSS'),
];

export interface WorldMonitorFetchResult {
  descriptor: WorldMonitorOperationDescriptor;
  payload: WorldMonitorPayload | null;
  status: 'ok' | 'skipped' | 'failed';
  httpStatus: number | null;
  message: string;
}

export class DbWorldMonitorSourceRepository {
  constructor(private readonly repoRoot: string = process.cwd(),
    private readonly referenceRoot = resolve(repoRoot, '../worldmonitor-main'),
    private readonly sourceDir = resolve(repoRoot, 'data/worldmonitor_exports'),
  ) {}

  buildInventory(input: { generatedAt: string; productionConfigured: boolean }): WorldMonitorSourceInventory {
    const apiDir = resolve(this.referenceRoot, 'docs/api');
    const sandbox = this.readSandboxIndex();
    const sandboxByOperation = new Map((sandbox.operations ?? []).map((item) => [item.operationId, item]));
    const operations: WorldMonitorOperationDescriptor[] = [];

    for (const file of existsSync(apiDir) ? readdirSync(apiDir).filter((name) => name.endsWith('.openapi.json')).sort() : []) {
      const document = JSON.parse(readFileSync(resolve(apiDir, file), 'utf8')) as OpenApiDocument;
      const service = basename(file, '.openapi.json');
      for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
          const operationId = operation.operationId ?? `${method}_${path}`;
          const required = (operation.parameters ?? []).filter((item) => item.required).flatMap((item) => item.name ? [item.name] : []);
          const optional = (operation.parameters ?? []).filter((item) => !item.required).flatMap((item) => item.name ? [item.name] : []);
          const classification = classifyWorldMonitorOperation({ service, path, operationId });
          const sandboxOperation = sandboxByOperation.get(operationId);
          const accessState = classification.eligibility === 'unsupported'
            ? 'unsupported'
            : method !== 'get'
              ? 'manual_request'
              : required.length
                ? 'requires_parameters'
                : input.productionConfigured
                  ? 'production_ready'
                  : sandboxOperation
                    ? 'sandbox_available'
                    : 'requires_key';
          operations.push({
            operation_id: operationId,
            service,
            method: method.toUpperCase(),
            path,
            summary: operation.summary ?? operationId,
            description: operation.description ?? '',
            required_parameters: required,
            optional_parameters: optional,
            domain: classification.domain,
            evidence_eligibility: classification.eligibility,
            auth_requirement: required.length ? 'source_parameters' : 'worldmonitor_key',
            access_state: accessState,
            sandbox_fixture: sandboxOperation?.fixture ?? null,
            production_url: sandboxOperation?.productionUrl ?? `https://api.worldmonitor.app${path}`,
            normalizer_id: normalizerIdForOperation(operationId),
            normalizer_version: '1.0.0',
            governance: governanceForWorldMonitorOperation({
              service,
              method: method.toUpperCase(),
              sourceClass: 'worldmonitor_hosted',
              eligibility: classification.eligibility,
              productionConfigured: input.productionConfigured,
            }),
          });
        }
      }
    }
    operations.push(...DIRECT_PUBLIC_OPERATIONS);
    operations.sort((a, b) => a.service.localeCompare(b.service) || a.operation_id.localeCompare(b.operation_id));
    return {
      artifact_type: 'worldmonitor_source_inventory',
      schema_version: '1.0.0',
      producer_version: '0.7.8',
      generated_at: input.generatedAt,
      reference_root: this.referenceRoot,
      production_configured: input.productionConfigured,
      service_count: new Set(operations.map((item) => item.service)).size,
      operation_count: operations.length,
      pollable_operation_count: operations.filter((item) => item.method === 'GET' && !item.required_parameters.length).length,
      candidate_operation_count: operations.filter((item) => item.evidence_eligibility === 'candidate').length,
      context_only_operation_count: operations.filter((item) => item.evidence_eligibility === 'context_only').length,
      unsupported_operation_count: operations.filter((item) => item.evidence_eligibility === 'unsupported').length,
      sandbox_operation_count: operations.filter((item) => item.sandbox_fixture).length,
      operations,
      guardrail_check: {
        catalog_is_not_connectivity_claim: true,
        sandbox_is_not_live_evidence: true,
        human_review_required: false,
        no_trading_advice: true,
      },
    };
  }

  readSandboxFixture(descriptor: WorldMonitorOperationDescriptor): unknown {
    if (!descriptor.sandbox_fixture) throw new Error(`${descriptor.operation_id}: sandbox fixture unavailable`);
    const fileName = basename(new URL(descriptor.sandbox_fixture).pathname);
    const path = resolve(this.referenceRoot, 'public/sandbox', fileName);
    if (!existsSync(path)) throw new Error(`${descriptor.operation_id}: local sandbox fixture missing`);
    const envelope = readGenericArtifact(path)! as { response?: { body?: unknown } };
    return envelope.response?.body ?? {};
  }

  writeInventory(inventory: WorldMonitorSourceInventory): void {
    writeGenericArtifact('sources/latest_source_inventory.json', inventory);
  }

  writeSyncReport(report: unknown): void {
    writeGenericArtifact('sources/latest_sync_report.json', report);
    const id = (report as { sync_id?: string }).sync_id ?? 'unknown';
    writeGenericArtifact(`sources/history/${id}.json`, report);
  }

  readFactState(): WorldMonitorFactState | null {
    const path = 'sources/latest_fact_state.json';
    if (!existsSync(path)) return null;
    try {
      return readGenericArtifact(path)! as WorldMonitorFactState;
    } catch {
      return null;
    }
  }

  writeFactState(state: WorldMonitorFactState): void {
    writeGenericArtifact('sources/latest_fact_state.json', state);
    writeGenericArtifact(`sources/history/${state.state_id}.json`, state);
  }

  seenPayloadHashes(): Set<string> {
    const directory = 'sources/history';
    if (!existsSync(directory)) return new Set();
    const hashes = new Set<string>();
    for (const file of readdirSync(directory).filter((name) => name.endsWith('.json'))) {
      try {
        const value = readGenericArtifact(resolve(directory, file))! as {
          records?: Array<{ payload_hash?: string | null }>;
        };
        for (const record of value.records ?? []) {
          if (record.payload_hash) hashes.add(record.payload_hash);
        }
      } catch {
        // A malformed historical artifact must not stop a new source inventory.
      }
    }
    return hashes;
  }

  private readSandboxIndex(): SandboxIndex {
    const path = resolve(this.referenceRoot, 'public/sandbox/index.json');
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as SandboxIndex : {};
  }
}

export class WorldMonitorHttpClient {
  constructor(
    private readonly apiKey: string | null,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 15_000,
  ) {}

  async fetchOperation(
    descriptor: WorldMonitorOperationDescriptor,
    mode: WorldMonitorSyncMode,
    sandboxBody?: unknown,
  ): Promise<WorldMonitorFetchResult> {
    if (mode === 'sandbox') {
      if (!descriptor.sandbox_fixture) return skipped(descriptor, 'No sandbox fixture is published for this operation.');
      const fetchedAt = new Date().toISOString();
      return {
        descriptor,
        payload: payload(descriptor, fetchedAt, descriptor.sandbox_fixture, mode, sandboxBody ?? {}),
        status: 'ok',
        httpStatus: 200,
        message: 'Sandbox contract fixture validated; it is not live evidence.',
      };
    }
    if (descriptor.auth_requirement === 'worldmonitor_key' && !this.apiKey) {
      return skipped(descriptor, 'WORLDMONITOR_API_KEY is not configured.');
    }
    if (descriptor.method !== 'GET' && !(descriptor.method === 'POST' && descriptor.post_body)) {
      return skipped(descriptor, 'Automatic polling only supports GET and form-body POST operations.');
    }
    if (descriptor.required_parameters.length) {
      return skipped(descriptor, `Required parameters: ${descriptor.required_parameters.join(', ')}`);
    }
    if (descriptor.evidence_eligibility === 'unsupported') return skipped(descriptor, 'Operation is not compatible with text Evidence intake.');

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
      const headers: Record<string, string> = {
        'User-Agent': 'NarrativeLifecycleDashboard/0.7.8 research-intake contact=local-operator',
        Accept: 'application/json, application/geo+json, application/rss+xml, application/atom+xml, text/xml, text/html',
      };
      if (descriptor.auth_requirement === 'worldmonitor_key' && this.apiKey) headers['X-WorldMonitor-Key'] = this.apiKey;
      if (descriptor.content_type) headers['Content-Type'] = descriptor.content_type;
      if (descriptor.request_headers) Object.assign(headers, descriptor.request_headers);
      const response = await this.fetchImpl(descriptor.production_url, {
        method: descriptor.method === 'POST' ? 'POST' : 'GET',
        headers,
        body: descriptor.method === 'POST' ? descriptor.post_body : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        if (attempt === 1 && (response.status === 429 || response.status >= 500)) continue;
        return {
          descriptor,
          payload: null,
          status: 'failed',
          httpStatus: response.status,
          message: `World Monitor returned HTTP ${response.status}.`,
        };
      }
      const raw = await response.text();
      const contentType = response.headers.get('content-type') ?? '';
      const trimmed = raw.trim();
      const body: unknown = contentType.includes('xml') || /^<\?xml|<rss|<feed/i.test(trimmed)
        ? { __xml: raw }
        : contentType.includes('html') || /^<!doctype|<html/i.test(trimmed.slice(0, 500))
          ? { __html: raw }
          : (() => {
              try {
                return JSON.parse(raw) as unknown;
              } catch {
                return { __raw_text: raw };
              }
            })();
      const fetchedAt = new Date().toISOString();
      return {
        descriptor,
        payload: payload(descriptor, fetchedAt, descriptor.production_url, mode, body),
        status: 'ok',
        httpStatus: response.status,
        message: 'Live response received; candidate conversion still requires human review.',
      };
      } catch (error) {
        if (attempt === 1) continue;
        return {
          descriptor,
          payload: null,
          status: 'failed',
          httpStatus: null,
          message: error instanceof Error ? error.message : String(error),
        };
      } finally {
        clearTimeout(timeout);
      }
    }
    return { descriptor, payload: null, status: 'failed', httpStatus: null, message: 'Source retry budget exhausted.' };
  }
}

function direct(
  operationId: string,
  service: string,
  url: string,
  domain: WorldMonitorOperationDescriptor['domain'],
  eligibility: WorldMonitorOperationDescriptor['evidence_eligibility'],
  summary: string,
  options?: { method?: 'GET' | 'POST'; post_body?: string; content_type?: string; headers?: Record<string, string> },
): WorldMonitorOperationDescriptor {
  const method = options?.method ?? 'GET';
  return {
    operation_id: operationId,
    service,
    method,
    path: new URL(url).pathname,
    summary,
    description: 'Direct public upstream documented by the World Monitor ingestion implementation.',
    required_parameters: [],
    optional_parameters: [],
    domain,
    evidence_eligibility: eligibility,
    auth_requirement: 'public_no_key',
    access_state: 'production_ready',
    sandbox_fixture: null,
    production_url: url,
    ...(options?.post_body ? { post_body: options.post_body } : {}),
    ...(options?.content_type ? { content_type: options.content_type } : {}),
    ...(options?.headers ? { request_headers: options.headers } : {}),
    normalizer_id: normalizerIdForOperation(operationId),
    normalizer_version: '1.0.0',
    governance: governanceForWorldMonitorOperation({
      service,
      method,
      sourceClass: 'direct_public',
      eligibility,
      productionConfigured: true,
    }),
  };
}

function payload(
  descriptor: WorldMonitorOperationDescriptor,
  fetchedAt: string,
  sourceUrl: string,
  mode: WorldMonitorSyncMode,
  body: unknown,
): WorldMonitorPayload {
  return {
    descriptor,
    fetched_at: fetchedAt,
    source_url: sourceUrl,
    mode,
    body,
    payload_hash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    degraded: isDegradedWorldMonitorPayload(body),
    stale: isStaleWorldMonitorPayload(body),
  };
}

function skipped(descriptor: WorldMonitorOperationDescriptor, message: string): WorldMonitorFetchResult {
  return { descriptor, payload: null, status: 'skipped', httpStatus: null, message };
}
