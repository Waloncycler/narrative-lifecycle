import { describe, expect, it } from 'vitest';
import {
  normalizedFactsFromWorldMonitorPayload,
  recordsForWorldMonitorPayload,
  signalsFromWorldMonitorPayload,
  sourceConfigForOperation,
} from '@/features/worldmonitor/domain/worldmonitor_rules';
import type { WorldMonitorOperationDescriptor, WorldMonitorPayload } from '@/features/worldmonitor/types/worldmonitor_adapter';

describe('World Monitor source-specific normalizers', () => {
  it('normalizes USGS event time, detail URL, location, and metrics', () => {
    const result = facts('DirectUSGSEarthquakes', {
      features: [{
        id: 'us-test',
        properties: {
          title: 'M 5.7 - Test Region',
          mag: 5.7,
          place: 'Test Region',
          time: Date.parse('2026-07-27T10:00:00Z'),
          status: 'reviewed',
          sig: 500,
          tsunami: 0,
          url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us-test',
        },
        geometry: { coordinates: [120.5, 35.2, 12.3] },
      }],
    });
    expect(result[0]).toMatchObject({
      event_at: '2026-07-27T10:00:00.000Z',
      source_url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us-test',
      location: { lng: 120.5, lat: 35.2 },
      metrics: { magnitude: 5.7, depth_km: 12.3, significance: 500, tsunami_flag: 0 },
      normalizer_id: 'usgs_earthquake',
    });
  });

  it('uses the latest NASA EONET geometry instead of fetch time', () => {
    const result = facts('DirectNASAEonetEvents', {
      events: [{
        id: 'EONET_1',
        title: 'Test Wildfire',
        link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1',
        categories: [{ title: 'Wildfires' }],
        geometry: [
          { date: '2026-07-20T00:00:00Z', coordinates: [10, 20] },
          { date: '2026-07-25T00:00:00Z', coordinates: [11, 21], magnitudeValue: 510, magnitudeUnit: 'acres' },
        ],
      }],
    });
    expect(result[0]).toMatchObject({
      event_at: '2026-07-25T00:00:00.000Z',
      source_url: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1',
      location: { lng: 11, lat: 21 },
      metrics: { magnitude: 510 },
    });
  });

  it('ignores NWS GeoJSON metadata and normalizes only feature alerts', () => {
    const payload = sourcePayload('DirectNWSAlerts', {
      '@context': { '@version': '1.1' },
      features: [{
        id: 'https://api.weather.gov/alerts/test',
        properties: {
          '@id': 'https://api.weather.gov/alerts/test',
          id: 'test',
          sent: '2026-07-27T22:11:00-07:00',
          onset: '2026-07-27T22:11:00-07:00',
          expires: '2026-07-27T23:00:00-07:00',
          event: 'Severe Thunderstorm Warning',
          headline: 'Severe Thunderstorm Warning for Test County',
          areaDesc: 'Test County',
          severity: 'Severe',
          certainty: 'Observed',
          urgency: 'Immediate',
        },
      }],
    });
    expect(recordsForWorldMonitorPayload(payload)).toHaveLength(1);
    const result = normalizedFactsFromWorldMonitorPayload(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      event_at: '2026-07-28T05:11:00.000Z',
      source_url: 'https://api.weather.gov/alerts/test',
      normalizer_id: 'nws_alert',
    });
  });

  it('resolves WHO item URLs and publication availability', () => {
    const result = facts('DirectWHODiseaseOutbreaks', {
      value: [{
        ItemDefaultUrl: '/2026-DON613',
        PublicationDateAndTime: '2026-07-17T16:13:00Z',
        Title: 'Test disease outbreak',
      }],
    });
    expect(result[0]).toMatchObject({
      event_at: '2026-07-17T16:13:00.000Z',
      available_at: '2026-07-17T16:13:00.000Z',
      source_url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON613',
    });
  });

  it('turns US Treasury values into readable metrics without raising Evidence strength', () => {
    const payload = sourcePayload('DirectUSTreasuryDebt', {
      data: [{ record_date: '2026-07-24', tot_pub_debt_out_amt: '39692374867364.99' }],
    });
    const result = normalizedFactsFromWorldMonitorPayload(payload);
    expect(result[0].metrics?.total_public_debt_usd).toBe(39692374867364.99);
    expect(result[0].summary).toContain('US Treasury reported total public debt');
    const signals = signalsFromWorldMonitorPayload(payload);
    expect(signals[0]).toMatchObject({
      event_date: '2026-07-24',
      normalizer_id: 'us_treasury_debt',
    });
  });

  it('counts CFTC and World Bank business records but keeps them context-only', () => {
    const cftc = sourcePayload('DirectCFTCCotFinancial', [{
      report_date_as_yyyy_mm_dd: '2026-07-21',
      market_and_exchange_names: 'TEST FUTURES',
      noncomm_positions_long_all: '120',
      noncomm_positions_short_all: '80',
    }], 'context_only');
    const worldBank = sourcePayload('DirectWorldBankGDP', [
      { page: 1, pages: 1 },
      [{ id: 'TST', country: { value: 'Testland' }, date: '2024', value: 1000 }],
    ], 'context_only');
    expect(recordsForWorldMonitorPayload(cftc)).toHaveLength(1);
    expect(recordsForWorldMonitorPayload(worldBank)).toHaveLength(1);
    expect(normalizedFactsFromWorldMonitorPayload(cftc)[0].metrics).toEqual({ noncommercial_net_contracts: 40 });
    expect(normalizedFactsFromWorldMonitorPayload(worldBank)[0].metrics).toEqual({ gdp_current_usd: 1000 });
    expect(signalsFromWorldMonitorPayload(cftc)).toEqual([]);
    expect(signalsFromWorldMonitorPayload(worldBank)).toEqual([]);
  });
});

describe('World Monitor extended direct source normalizers (v0.7.9)', () => {
  it('normalizes Sina readership for triage without raising Evidence strength', () => {
    const payload = sourcePayload('DirectSinaFinance', {
      result: { data: { feed: { list: [{
        id: 42,
        rich_text: '国务院批准一项重大产业政策，项目金额达到120亿元',
        create_time: '2026-08-13 10:00:00',
        docurl: 'https://finance.sina.cn/7x24/example.d.html',
        view_num: '293.85万 阅读',
        comment_num: 32,
      }] } } },
    });
    const result = normalizedFactsFromWorldMonitorPayload(payload);
    expect(result[0].metrics).toMatchObject({ read_count: 2938500, comment_count: 32 });
    expect(sourceConfigForOperation({ operation_id: 'DirectSinaFinance', service: 'SinaFinance' } as WorldMonitorOperationDescriptor).default_evidence_strength).toBe('E1');
  });

  it('separates a Sina bracketed headline from the article body for topic mapping', () => {
    const result = normalizedFactsFromWorldMonitorPayload(sourcePayload('DirectSinaFinance', {
      result: { data: { feed: { list: [{
        id: 43,
        rich_text: '【伦敦股市13日下跌】英国股指收跌，正文顺带提到一家房地产公司和信息技术服务公司。',
        create_time: '2026-08-13 10:00:00', docurl: 'https://finance.sina.cn/7x24/example-43.d.html',
      }] } } },
    }));
    expect(result[0]?.title).toBe('伦敦股市13日下跌');
    expect(result[0]?.summary).toContain('正文顺带提到一家房地产公司');
  });

  it('normalizes approved CLS connector readership payloads', () => {
    const result = facts('DirectCailianTelegraph', {
      data: { roll_data: [{
        id: 7,
        title: '政策发布',
        content: '监管部门发布新规',
        ctime: 1786586400,
        reading_num: 820000,
        comment_num: 12,
        level: 8,
      }] },
    });
    expect(result[0].metrics).toMatchObject({ read_count: 820000, comment_count: 12, editorial_priority: 8 });
  });

  it('normalizes GDELT articles to name-layer facts', () => {
    const result = facts('DirectGdeltDocArticles', {
      articles: [{
        url: 'https://example.com/global-news',
        title: 'Test global news event',
        seendate: '20260728123000',
        domain: 'example.com',
        language: 'eng',
        sourcecountry: 'CN',
      }],
    });
    expect(result[0]).toMatchObject({
      event_at: '2026-07-28T12:30:00.000Z',
      event_type: 'GLOBAL_NEWS_EVENT',
      source_url: 'https://example.com/global-news',
      location: { country: 'CN' },
      normalizer_id: 'gdelt_doc_article',
    });
  });

  it('normalizes Coinbase spot quotes with numeric metrics', () => {
    const result = facts('DirectCoinbaseSpotPrice', {
      data: { base: 'BTC', currency: 'USD', amount: '104523.45' },
    });
    expect(result[0]).toMatchObject({
      event_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      event_type: 'CRYPTO_SPOT_PRICE',
      upstream_record_id: 'BTC-USD',
      metrics: { spot_price: 104523.45 },
      normalizer_id: 'coinbase_spot_price',
    });
  });

  it('normalizes Eastmoney concept boards into capital-layer facts', () => {
    const result = facts('DirectEastmoneyConceptBoards', {
      data: { diff: [{ f12: 'BK1001', f14: '脑机接口', f2: 1200.5, f3: 3.25, f8: 2.1, f20: 8500.0 }] },
    });
    expect(result[0]).toMatchObject({
      event_type: 'CONCEPT_BOARD_MOVE',
      location: { country: 'China', region_name: 'A股概念板块' },
      metrics: { change_pct: 3.25, price: 1200.5, turnover_rate: 2.1, total_market_cap_yi: 8500 },
      normalizer_id: 'eastmoney_concept_board',
    });
    expect(result[0].title).toContain('脑机接口');
  });

  it('normalizes Eastmoney stock quotes with direction in the title', () => {
    const result = facts('DirectEastmoneyStockQuote', {
      data: {
        f57: '688981',
        f58: '中芯国际',
        f43: 88.5,
        f44: 89.0,
        f45: 87.0,
        f46: 87.5,
        f47: 100000,
        f48: 88000000,
        f169: 1.2,
        f170: 1.37,
      },
    });
    expect(result[0]).toMatchObject({
      event_type: 'A_SHARE_QUOTE',
      upstream_record_id: '688981',
      metrics: { latest: 88.5, change_pct: 1.37, volume: 100000 },
      normalizer_id: 'eastmoney_stock_quote',
    });
    expect(result[0].title).toContain('中芯国际');
  });

  it('normalizes ClinicalTrials.gov v2 study objects', () => {
    const result = facts('DirectClinicalTrialsGovStudies', {
      studies: [{
        protocolSection: {
          identificationModule: { nctId: 'NCT0001', briefTitle: 'Test oncology trial' },
          statusModule: {
            overallStatus: 'RECRUITING',
            studyFirstPostDateStruct: { date: '2026-01-01' },
            lastUpdatePostDateStruct: { date: '2026-07-29' },
          },
          designModule: { studyType: 'INTERVENTIONAL', enrollmentInfo: { count: 120 } },
          conditionsModule: { conditions: ['Lung Cancer'] },
          contactsLocationsModule: { locations: [{ country: 'United States' }] },
        },
      }],
    });
    expect(result[0]).toMatchObject({
      event_at: '2026-07-29T00:00:00.000Z',
      event_type: 'CLINICAL_TRIAL_UPDATE',
      source_url: 'https://clinicaltrials.gov/study/NCT0001',
      location: { country: 'United States' },
      metrics: { enrollment_count: 120 },
      normalizer_id: 'clinical_trial_update',
    });
    expect(result[0].summary).toContain('Lung Cancer');
  });

  it('normalizes UN Comtrade preview rows', () => {
    const result = facts('DirectUnComtradePreview', {
      count: 1,
      data: [{
        refYear: 2024,
        reporterCode: 156,
        partnerCode: 0,
        cmdCode: '8549',
        flowCode: 'X',
        primaryValue: 1234567.89,
        qty: 100,
        netWeight: 2000,
      }],
    });
    expect(result[0]).toMatchObject({
      event_type: 'TRADE_FLOW_RECORDED',
      upstream_record_id: '2024-156-X-8549-0',
      metrics: { trade_value_usd: 1234567.89, quantity: 100, net_weight_kg: 2000 },
      normalizer_id: 'un_comtrade_flow',
    });
  });

  it('maps the new operations to lifecycle layers via the merged source catalog', () => {
    expect(sourceConfigForOperation({ operation_id: 'DirectCoinbaseSpotPrice', service: 'CoinbaseSpotPrice' } as WorldMonitorOperationDescriptor).primary_layer).toBe('capital');
    expect(sourceConfigForOperation({ operation_id: 'DirectEastmoneyConceptBoards', service: 'EastmoneyConceptBoards' } as WorldMonitorOperationDescriptor).primary_layer).toBe('capital');
    expect(sourceConfigForOperation({ operation_id: 'DirectEastmoneyStockQuote', service: 'EastmoneyStockQuote' } as WorldMonitorOperationDescriptor).primary_layer).toBe('capital');
    expect(sourceConfigForOperation({ operation_id: 'DirectClinicalTrialsGovStudies', service: 'ClinicalTrialsGov' } as WorldMonitorOperationDescriptor).primary_layer).toBe('reality');
    expect(sourceConfigForOperation({ operation_id: 'DirectUnComtradePreview', service: 'UnComtradePreview' } as WorldMonitorOperationDescriptor).primary_layer).toBe('reality');
    expect(sourceConfigForOperation({ operation_id: 'DirectGdeltDocArticles', service: 'GdeltDocArticles' } as WorldMonitorOperationDescriptor).primary_layer).toBe('name');
    // Existing fallback behavior is preserved for unlisted operations
    expect(sourceConfigForOperation({ operation_id: 'ListEarthquakes', service: 'USGSSeismology', domain: 'climate' } as WorldMonitorOperationDescriptor).primary_layer).toBe('reality');
  });
});

describe('World Monitor vendor & industry signal normalizers (v0.8.0)', () => {
  it('zips SEC EDGAR submissions into official reality-layer facts', () => {
    const result = facts('DirectSecEdgarNvidia', {
      name: 'NVIDIA CORP',
      cik: 1045810,
      filings: {
        recent: {
          form: ['8-K', '10-Q'],
          filingDate: ['2026-07-20', '2026-06-15'],
          accessionNumber: ['0001045810-26-000123', '0001045810-26-000100'],
          primaryDocument: ['form8k.htm', 'form10q.htm'],
          reportDate: ['2026-07-15', '2026-04-30'],
        },
      },
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      event_at: '2026-07-20T00:00:00.000Z',
      event_type: 'OFFICIAL_SEC_FILING',
      upstream_record_id: '0001045810-26-000123',
      normalizer_id: 'sec_edgar_submission',
    });
    expect(result[0].title).toContain('NVIDIA CORP filed 8-K');
    expect(result[0].source_url).toContain('sec.gov');
    expect(result[0].summary).toContain('official SEC EDGAR submission');
  });

  it('skips SEC rows without a filing form', () => {
    const result = facts('DirectSecEdgarApple', {
      name: 'Apple Inc.',
      filings: { recent: { form: [null], filingDate: ['2026-07-01'] } },
    });
    expect(result).toHaveLength(0);
  });

  it('normalizes Hacker News community signals with points and comments', () => {
    const result = facts('DirectHackerNewsStories', {
      hits: [{
        objectID: '4212345',
        title: 'Show HN: robotics research update',
        url: 'https://example.com/robotics',
        created_at: '2026-07-27T09:00:00Z',
        points: 145,
        num_comments: 38,
        author: 'tester',
      }],
    });
    expect(result[0]).toMatchObject({
      event_type: 'COMMUNITY_DISCUSSION_SIGNAL',
      upstream_record_id: '4212345',
      source_url: 'https://example.com/robotics',
      metrics: { points: 145, comments: 38 },
      normalizer_id: 'hacker_news_story',
    });
  });

  it('normalizes the Fear & Greed sentiment index timestamp', () => {
    const result = facts('DirectFearGreedIndex', {
      data: [{ value: '27', value_classification: 'Fear', timestamp: '1785542400' }],
    });
    expect(result[0]).toMatchObject({
      event_type: 'MARKET_SENTIMENT_INDEX',
      metrics: { sentiment_index: 27 },
      normalizer_id: 'fear_greed_index',
    });
    expect(result[0].title).toContain('27');
  });

  it('normalizes CoinGecko trending items into name-layer signals', () => {
    const result = facts('DirectCoinGeckoTrending', {
      coins: [{ item: { id: 'test-token', name: 'Test Token', symbol: 'TST', market_cap_rank: 51, price_btc: 0.0001 } }],
    });
    expect(result[0]).toMatchObject({
      event_type: 'MARKET_TRENDING_ASSET',
      upstream_record_id: 'test-token',
      source_url: 'https://www.coingecko.com/en/coins/test-token',
      metrics: { market_cap_rank: 51, price_btc: 0.0001 },
      normalizer_id: 'coingecko_trending',
    });
  });

  it('maps the new vendor and industry operations via the merged source catalog', () => {
    expect(sourceConfigForOperation({ operation_id: 'DirectSecEdgarNvidia', service: 'SecEdgarNvidia' } as WorldMonitorOperationDescriptor).primary_layer).toBe('reality');
    expect(sourceConfigForOperation({ operation_id: 'DirectSecEdgarApple', service: 'SecEdgarApple' } as WorldMonitorOperationDescriptor).primary_layer).toBe('reality');
    expect(sourceConfigForOperation({ operation_id: 'DirectSecEdgarTsmc', service: 'SecEdgarTsmc' } as WorldMonitorOperationDescriptor).primary_layer).toBe('reality');
    expect(sourceConfigForOperation({ operation_id: 'DirectHackerNewsStories', service: 'HackerNewsAlgolia' } as WorldMonitorOperationDescriptor).primary_layer).toBe('name');
    expect(sourceConfigForOperation({ operation_id: 'DirectFearGreedIndex', service: 'AlternativeMeFearGreed' } as WorldMonitorOperationDescriptor).primary_layer).toBe('capital');
    expect(sourceConfigForOperation({ operation_id: 'DirectCoinGeckoTrending', service: 'CoinGeckoTrending' } as WorldMonitorOperationDescriptor).primary_layer).toBe('name');
  });
});

describe('World Monitor feed-style sources (RSS/Atom, HTML, JSON lists)', () => {
  it('parses RSS 2.0 items into vendor announcement candidates', () => {
    const result = facts('DirectOpenAiBlog', {
      __xml: `<?xml version="1.0"?><rss version="2.0"><channel><item>
        <title>Introducing a new model capability</title>
        <link>https://openai.com/news/capability</link>
        <guid>openai-news-123</guid>
        <pubDate>Mon, 27 Jul 2026 10:00:00 GMT</pubDate>
        <description>&lt;p&gt;Announcement body.&lt;/p&gt;</description>
      </item></channel></rss>`,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'Introducing a new model capability',
      source_url: 'https://openai.com/news/capability',
      event_type: 'OFFICIAL_ANNOUNCEMENT',
      normalizer_id: 'openai_blog_announcement',
    });
    expect(result[0].event_at).toBe('2026-07-27T10:00:00.000Z');
  });

  it('parses Atom entries from arXiv into preprint candidates', () => {
    const result = facts('DirectArxivPreprints', {
      __xml: `<feed xmlns="http://www.w3.org/2005/Atom"><entry>
        <title>Scaling laws for agentic systems</title>
        <id>http://arxiv.org/abs/2607.12345v1</id>
        <link href="http://arxiv.org/abs/2607.12345v1"/>
        <published>2026-07-25T00:00:00Z</published>
        <summary>We study scaling laws.</summary>
        <author><name>Jane Doe</name></author>
      </entry></feed>`,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'Scaling laws for agentic systems',
      source_url: 'http://arxiv.org/abs/2607.12345v1',
      event_type: 'PREPRINT_PUBLISHED',
      normalizer_id: 'arxiv_preprint',
    });
    expect(result[0].summary).toContain('Jane Doe');
  });

  it('normalizes GitHub release Atom feeds for Anthropic and xAI', () => {
    const anthropic = facts('DirectAnthropicReleases', {
      __xml: `<feed xmlns="http://www.w3.org/2005/Atom"><entry>
        <title>Release 2.0.0</title>
        <id>tag:github.com,2008:Repository/123</id>
        <link href="https://github.com/anthropics/anthropic-sdk-python/releases/tag/v2.0.0"/>
        <updated>2026-07-20T08:00:00Z</updated>
        <content>Highlights and fixes.</content>
      </entry></feed>`,
    });
    expect(anthropic[0]).toMatchObject({
      title: 'Release 2.0.0',
      source_url: 'https://github.com/anthropics/anthropic-sdk-python/releases/tag/v2.0.0',
      event_type: 'OFFICIAL_ANNOUNCEMENT',
      normalizer_id: 'anthropic_release',
    });
  });

  it('normalizes Hugging Face model JSON list with download metrics', () => {
    const result = facts('DirectHuggingFaceModels', [
      { id: 'meta-llama/llama-4', downloads: 12000, likes: 340, pipeline_tag: 'text-generation', lastModified: '2026-07-01T00:00:00Z' },
    ]);
    expect(result[0]).toMatchObject({
      title: 'meta-llama/llama-4',
      source_url: 'https://huggingface.co/meta-llama/llama-4',
      event_type: 'OPEN_SOURCE_MODEL',
      normalizer_id: 'huggingface_model',
      metrics: { downloads: 12000, likes: 340 },
    });
  });

  it('normalizes GitHub search API items with star metrics', () => {
    const result = facts('DirectGithubTrending', {
      items: [{
        full_name: 'org/agent-framework',
        html_url: 'https://github.com/org/agent-framework',
        description: 'A framework',
        stargazers_count: 5000,
        forks_count: 120,
      }],
    });
    expect(result[0]).toMatchObject({
      title: 'org/agent-framework',
      source_url: 'https://github.com/org/agent-framework',
      event_type: 'OPEN_SOURCE_REPO',
      normalizer_id: 'github_repo_signal',
      metrics: { stars: 5000, forks: 120 },
    });
  });

  it('normalizes Sina Finance roll JSON and CNINFO announcements', () => {
    const sina = facts('DirectSinaFinance', {
      result: { data: [{ url: 'https://finance.sina.com.cn/x', title: '发改委发布最新政策', ctime: 1753000000 }] },
    });
    expect(sina[0]).toMatchObject({
      event_type: 'NEWS_ARTICLE_PUBLISHED',
      normalizer_id: 'news_article',
      source_url: 'https://finance.sina.com.cn/x',
    });
    expect(sina[0].event_at).toBe(new Date(1753000000 * 1000).toISOString());

    const cninfo = facts('DirectCninfoAnnouncements', {
      announcements: [{
        announcementTitle: '2026年半年度报告',
        announcementTime: 1753000000000,
        adjunctUrl: '/finalpage/2026-07/1203456789.PDF',
        secCode: '600519',
        secName: '贵州茅台',
      }],
    });
    expect(cninfo[0]).toMatchObject({
      title: '贵州茅台 (600519) 公告: 2026年半年度报告',
      event_type: 'OFFICIAL_ANNOUNCEMENT',
      normalizer_id: 'cninfo_announcement',
    });
    expect(cninfo[0].source_url).toContain('static.cninfo.com.cn');
    expect(cninfo[0].event_at).toBe(new Date(1753000000000).toISOString());
  });

  it('marks financial media feeds as news-only discovery inputs', () => {
    const descriptor = { operation_id: 'DirectWSJBusiness', service: 'WSJBusiness', domain: 'financial' } as WorldMonitorOperationDescriptor;
    expect(sourceConfigForOperation(descriptor)).toMatchObject({
      source_type: 'news',
      default_evidence_strength: 'E1',
      default_stage_effect: 'maintain',
    });
  });

  it('normalizes SSE and SZSE exchange announcement JSON APIs', () => {
    const sse = facts('DirectSseAnnouncements', {
      pageHelp: {
        data: [{
          TITLE: '亚宝药业集团股份有限公司2026年半年度报告',
          SECURITY_NAME: '亚宝药业',
          SECURITY_CODE: '600351',
          ADDDATE: '2026-07-31 15:52:31',
          URL: '/disclosure/listedinfo/announcement/c/new/2026-08-01/600351_20260801_G84J.pdf',
        }],
      },
    });
    expect(sse[0]).toMatchObject({
      title: '亚宝药业 (600351) 公告: 亚宝药业集团股份有限公司2026年半年度报告',
      event_type: 'OFFICIAL_GOV_ANNOUNCEMENT',
      normalizer_id: 'exchange_announcement',
    });
    expect(sse[0].source_url).toContain('static.sse.com.cn');
    expect(sse[0].event_at).toBe(new Date('2026-07-31 15:52:31').toISOString());

    const szse = facts('DirectSzseAnnouncements', {
      data: [{
        title: '2024年年度报告全文（更新后）',
        secCode: ['000753'],
        secName: ['漳州发展'],
        publishTime: '2026-07-31 00:00:00',
        attachPath: '/disc/disk03/finalpage/2026-07-31/4da722ef-f621-44e3-a0dd-2e5ebef08a95.PDF',
      }],
    });
    expect(szse[0]).toMatchObject({
      title: '漳州发展 (000753) 公告: 2024年年度报告全文（更新后）',
      event_type: 'OFFICIAL_GOV_ANNOUNCEMENT',
      normalizer_id: 'exchange_announcement',
    });
    expect(szse[0].source_url).toContain('disc.static.szse.cn');
  });

  it('parses Bloomberg Technology RSS and Concordia AI research feeds', () => {
    const bloomberg = facts('DirectBloombergTech', {
      __xml: `<rss version="2.0"><channel><item>
        <title><![CDATA[OpenAI Debuts Agent Tooling With Enterprise Focus]]></title>
        <link>https://www.bloomberg.com/news/articles/2026-07-30/example</link>
        <guid>bbg-2026-07-30-example</guid>
        <pubDate>Thu, 30 Jul 2026 09:00:00 GMT</pubDate>
        <description><![CDATA[Bloomberg Technology coverage.]]></description>
      </item></channel></rss>`,
    });
    expect(bloomberg[0]).toMatchObject({
      title: 'OpenAI Debuts Agent Tooling With Enterprise Focus',
      source_url: 'https://www.bloomberg.com/news/articles/2026-07-30/example',
      event_type: 'NEWS_ARTICLE_PUBLISHED',
      normalizer_id: 'news_article',
    });

    const concordia = facts('DirectConcordiaResearch', {
      __xml: `<rss version="2.0"><channel><item>
        <title>International AI Safety Report 2026</title>
        <link>https://concordia-ai.com/research/international-ai-safety-report-2026/</link>
        <guid>https://concordia-ai.com/?p=123</guid>
        <pubDate>Wed, 29 Jul 2026 12:00:00 GMT</pubDate>
        <description>&lt;p&gt;A global assessment of frontier AI risks.&lt;/p&gt;</description>
      </item></channel></rss>`,
    });
    expect(concordia[0]).toMatchObject({
      title: 'International AI Safety Report 2026',
      source_url: 'https://concordia-ai.com/research/international-ai-safety-report-2026/',
      event_type: 'RESEARCH_REPORT_PUBLISHED',
      normalizer_id: 'research_report',
    });
    expect(concordia[0].summary).toContain('研究报告发布于');
  });

  it('extracts article anchors from server-rendered gov HTML while ignoring navigation', () => {
    const result = facts('DirectNdrcNews', {
      __html: `
        <html><body>
          <a href="http://www.gov.cn/">首页</a>
          <ul>
            <li><a href="./xwfb/202607/t20260731_1406862.html">国家发展改革委举行7月份新闻发布会</a><span>2026-07-31</span></li>
            <li><a href="./xwfb/202607/t20260728_1406111.html">关于进一步扩大内需的政策措施</a></li>
          </ul>
        </body></html>`,
    });
    const titles = result.map((fact) => fact.title);
    expect(titles).toContain('国家发展改革委举行7月份新闻发布会');
    expect(titles).toContain('关于进一步扩大内需的政策措施');
    expect(titles).not.toContain('首页');
    const news = result.find((fact) => fact.title.includes('国家发展改革委'));
    expect(news).toMatchObject({
      event_type: 'OFFICIAL_GOV_ANNOUNCEMENT',
      normalizer_id: 'gov_announcement',
    });
    expect(news?.source_url).toContain('xwfb/202607/t20260731_1406862.html');
    expect(news?.event_at).toBe('2026-07-31T00:00:00.000Z');
  });

  it('turns live feed signals into low-strength unresolved candidates', () => {
    const payload = sourcePayload('DirectOpenAiBlog', {
      __xml: `<rss version="2.0"><channel><item><title>New release</title><link>https://openai.com/x</link><pubDate>Mon, 27 Jul 2026 10:00:00 GMT</pubDate></item></channel></rss>`,
    });
    const signals = signalsFromWorldMonitorPayload(payload);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      event_title: 'New release',
      event_date: '2026-07-27',
      event_type: 'OFFICIAL_ANNOUNCEMENT',
      normalizer_id: 'openai_blog_announcement',
    });
  });

  it('maps feed operations to lifecycle layers through the catalog', () => {
    expect(sourceConfigForOperation({ operation_id: 'DirectOpenAiBlog', service: 'OpenAiBlog' } as WorldMonitorOperationDescriptor)?.primary_layer).toBe('name');
    expect(sourceConfigForOperation({ operation_id: 'DirectGovCnPolicy', service: 'GovCnPolicy' } as WorldMonitorOperationDescriptor)?.primary_layer).toBe('friction');
    expect(sourceConfigForOperation({ operation_id: 'DirectArxivPreprints', service: 'ArxivPreprints' } as WorldMonitorOperationDescriptor)?.primary_layer).toBe('reality');
    expect(sourceConfigForOperation({ operation_id: 'DirectHuggingFaceModels', service: 'HuggingFaceModels' } as WorldMonitorOperationDescriptor)?.primary_layer).toBe('reality');
    expect(sourceConfigForOperation({ operation_id: 'DirectCrunchbaseNews', service: 'CrunchbaseNews' } as WorldMonitorOperationDescriptor)?.primary_layer).toBe('name');
  });

  it('normalizes TradingView top-provider feeds (Gelonghui JSON, BusinessWire RSS)', () => {
    const gelonghui = facts('DirectGelonghui', {
      statusCode: 200,
      totalCount: 2,
      result: [
        {
          type: 'contents',
          data: {
            title: '净利飙涨715倍！存储龙头江波龙半年报炸场',
            summary: '业绩爆发受益于存储行业景气回归',
            timestamp: 1786371048,
            link: 'https://www.gelonghui.com/p/5993440',
            nick: '茶山',
          },
        },
        {
          type: 'contents',
          data: {
            title: 'Meta发布可单卡运行轻量AI模型',
            timestamp: 1786371100,
            link: 'https://www.gelonghui.com/p/5993441',
          },
        },
      ],
    });
    expect(gelonghui).toHaveLength(2);
    expect(gelonghui[0]).toMatchObject({
      title: '净利飙涨715倍！存储龙头江波龙半年报炸场',
      source_url: 'https://www.gelonghui.com/p/5993440',
      event_type: 'NEWS_ARTICLE_PUBLISHED',
      normalizer_id: 'news_article',
    });
    expect(gelonghui[0].event_at).toBe(new Date(1786371048 * 1000).toISOString());
    expect(gelonghui[0].summary).toContain('业绩爆发受益于存储行业景气回归');

    const businessWire = facts('DirectBusinessWire', {
      __xml: `<rss version="2.0"><channel><item>
        <title>Example Corp Announces Record Q2 Results</title>
        <link>https://www.businesswire.com/news/home/20260728005123/en/</link>
        <guid>20260728005123</guid>
        <pubDate>Tue, 28 Jul 2026 08:00:00 GMT</pubDate>
        <description><![CDATA[Quarterly financial highlights.]]></description>
      </item></channel></rss>`,
    });
    expect(businessWire).toHaveLength(1);
    expect(businessWire[0]).toMatchObject({
      title: 'Example Corp Announces Record Q2 Results',
      source_url: 'https://www.businesswire.com/news/home/20260728005123/en/',
      event_type: 'NEWS_ARTICLE_PUBLISHED',
      normalizer_id: 'news_article',
    });
    expect(businessWire[0].event_at).toBe('2026-07-28T08:00:00.000Z');
  });

  it('maps TradingView top-provider operations to media lifecycle layers', () => {
    expect(sourceConfigForOperation({ operation_id: 'DirectBusinessWire', service: 'BusinessWire' } as WorldMonitorOperationDescriptor)?.primary_layer).toBe('name');
    expect(sourceConfigForOperation({ operation_id: 'DirectGelonghui', service: 'Gelonghui' } as WorldMonitorOperationDescriptor)?.primary_layer).toBe('name');
    expect(sourceConfigForOperation({ operation_id: 'DirectPANews', service: 'PANews' } as WorldMonitorOperationDescriptor)?.primary_layer).toBe('name');
    expect(sourceConfigForOperation({ operation_id: 'DirectFx168', service: 'Fx168' } as WorldMonitorOperationDescriptor)?.primary_layer).toBe('name');
    expect(sourceConfigForOperation({ operation_id: 'DirectGlobeNewswire', service: 'GlobeNewswire' } as WorldMonitorOperationDescriptor)?.primary_layer).toBe('name');
    expect(sourceConfigForOperation({ operation_id: 'DirectBusinessWire', service: 'BusinessWire' } as WorldMonitorOperationDescriptor)?.default_event_type).toBe('NEWS_ARTICLE_PUBLISHED');
  });
});

function facts(operationId: string, body: unknown) {
  return normalizedFactsFromWorldMonitorPayload(sourcePayload(operationId, body));
}

function sourcePayload(
  operationId: string,
  body: unknown,
  eligibility: WorldMonitorOperationDescriptor['evidence_eligibility'] = 'candidate',
): WorldMonitorPayload {
  const descriptor: WorldMonitorOperationDescriptor = {
    operation_id: operationId,
    service: operationId,
    method: 'GET',
    path: '/test',
    summary: operationId,
    description: '',
    required_parameters: [],
    optional_parameters: [],
    domain: operationId.includes('WHO') ? 'health' : operationId.includes('Treasury') || operationId.includes('CFTC') || operationId.includes('WorldBank') ? 'financial' : 'climate',
    evidence_eligibility: eligibility,
    auth_requirement: 'public_no_key',
    access_state: 'production_ready',
    sandbox_fixture: null,
    production_url: 'https://example.test/source',
    normalizer_id: 'test_normalizer',
    normalizer_version: '1.0.0',
    governance: {
      source_class: 'direct_public',
      governance_state: 'research_ready',
      terms_status: 'provider_terms_apply',
      license_id: 'test',
      terms_url: 'https://example.test/terms',
      attribution_required: true,
      redistribution_allowed: false,
      sensitivity: 'public',
      raw_payload_policy: 'transient_hash_only',
      retention_days: 0,
      freshness_window_hours: 24,
      automated_polling_allowed: true,
      observation_window: 'sliding_time',
      absence_assertion_allowed: false,
    },
  };
  return {
    descriptor,
    fetched_at: '2026-07-28T12:00:00.000Z',
    source_url: descriptor.production_url,
    mode: 'live',
    body,
    payload_hash: 'abcdef0123456789',
    degraded: false,
    stale: false,
  };
}
