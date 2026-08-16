import type { WebSearchConfig } from '@/features/research/types/web_research';

/** Search providers that require no API key or configuration: usable out of
 *  the box. `free` aggregates the keyless sources below into one result set. */
const KEYLESS_PROVIDERS = new Set<WebSearchConfig['provider']>(['free', 'gdelt', 'wikipedia', 'hn', 'duckduckgo', 'reddit', 'arxiv', 'openalex', 'archive', 'bing', 'yahoo_finance', 'eastmoney']);
// searxng / minimax intentionally stay outside the keyless set: SearXNG needs
// a configured baseUrl and MiniMax needs a Token Plan credential.
const SUPPORTED_PROVIDERS = new Set<WebSearchConfig['provider']>(['disabled', ...KEYLESS_PROVIDERS, 'brave', 'tavily', 'minimax', 'searxng', 'mcp_bridge', 'exa', 'jina_search', 'firecrawl', 'x_twitter']);

const DEFAULT_ENDPOINTS: Partial<Record<WebSearchConfig['provider'], string>> = {
  gdelt: 'https://api.gdeltproject.org/api/v2/doc/doc',
  brave: 'https://api.search.brave.com/res/v1/web/search',
  tavily: 'https://api.tavily.com/search',
  hn: 'https://hn.algolia.com/api/v1/search',
  duckduckgo: 'https://html.duckduckgo.com/html/',
  reddit: 'https://www.reddit.com/search.json',
  arxiv: 'https://export.arxiv.org/api/query',
  openalex: 'https://api.openalex.org/works',
  archive: 'https://archive.org/advancedsearch.php',
  bing: 'https://www.bing.com/search',
  exa: 'https://api.exa.ai/search',
  jina_search: 'https://s.jina.ai/',
  firecrawl: 'https://api.firecrawl.dev/v1/search',
};

/** MiniMax Token Plan search endpoints by region. */
const MINIMAX_SEARCH_ENDPOINTS: Record<'global' | 'cn', string> = {
  global: 'https://api.minimax.io/v1/coding_plan/search',
  cn: 'https://api.minimaxi.com/v1/coding_plan/search',
};

export function webSearchConfigFromEnv(env: NodeJS.ProcessEnv): WebSearchConfig {
  const provider = resolvePrimaryProvider(env);
  return buildWebSearchConfig(provider, env);
}

/** All search engines a research pass should run, in parallel. The keyless
 *  `free` aggregate is always included; every configured keyed/self-hosted
 *  engine (MiniMax, SearXNG, Tavily, Brave, MCP bridge) joins it instead of
 *  replacing it, so one query sweeps every engine the operator has enabled.
 *  NARRATIVE_WEB_SEARCH_PROVIDERS / NARRATIVE_WEB_SEARCH_PROVIDER only add
 *  extra engines (e.g. a standalone DuckDuckGo pass); they never narrow the
 *  set down to a single engine. */
export function webSearchConfigsFromEnv(env: NodeJS.ProcessEnv): WebSearchConfig[] {
  const requested = parseRequestedProviders(env);
  const configs: WebSearchConfig[] = [];
  const add = (provider: WebSearchConfig['provider']): void => {
    if (provider === 'disabled' || configs.some((config) => config.provider === provider)) return;
    configs.push(buildWebSearchConfig(provider, env));
  };

  // The keyless free aggregate is always on: it works with zero
  // configuration, so every other engine joins it instead of replacing it.
  if (!requested.has('disabled')) add('free');

  // Primary live cloud search providers
  if (env.FIRECRAWL_API_KEY?.trim()) add('firecrawl');
  if (env.EXA_API_KEY?.trim()) add('exa');
  if (env.TAVILY_API_KEY?.trim()) add('tavily');
  if (env.JINA_API_KEY?.trim()) add('jina_search');
  if (env.BRAVE_SEARCH_API_KEY?.trim()) add('brave');
  if (env.SERPER_API_KEY?.trim()) add('mcp_bridge');
  if (env.SEARXNG_BASE_URL?.trim()) add('searxng');
  if (env.MINIMAX_CODE_PLAN_KEY?.trim() || env.MINIMAX_CODING_API_KEY?.trim()
    || env.MINIMAX_OAUTH_TOKEN?.trim() || env.MINIMAX_API_KEY?.trim()) add('minimax');

  // Explicitly requested engines join the set as standalone passes.
  for (const provider of requested) {
    if (SUPPORTED_PROVIDERS.has(provider as WebSearchConfig['provider'])) add(provider as WebSearchConfig['provider']);
  }

  return configs.length ? configs : [buildWebSearchConfig('disabled', env)];
}

function parseRequestedProviders(env: NodeJS.ProcessEnv): Set<string> {
  const listed = env.NARRATIVE_WEB_SEARCH_PROVIDERS?.trim().toLowerCase();
  const single = env.NARRATIVE_WEB_SEARCH_PROVIDER?.trim().toLowerCase();
  return new Set(listed ? listed.split(/[\s,]+/).filter(Boolean) : single ? [single] : []);
}

function resolvePrimaryProvider(env: NodeJS.ProcessEnv): WebSearchConfig['provider'] {
  const requested = parseRequestedProviders(env).values().next().value as string | undefined;
  return (requested
    ?? (env.FIRECRAWL_API_KEY ? 'firecrawl'
      : env.EXA_API_KEY ? 'exa'
      : env.TAVILY_API_KEY ? 'tavily'
      : env.JINA_API_KEY ? 'jina_search'
      : env.BRAVE_SEARCH_API_KEY ? 'brave'
      : env.SERPER_API_KEY ? 'mcp_bridge'
      : env.SEARXNG_BASE_URL?.trim() ? 'searxng'
      : env.MINIMAX_CODE_PLAN_KEY?.trim() || env.MINIMAX_CODING_API_KEY?.trim() ? 'minimax'
      : 'free')) as WebSearchConfig['provider'];
}

function buildWebSearchConfig(provider: WebSearchConfig['provider'], env: NodeJS.ProcessEnv): WebSearchConfig {
  const selected = SUPPORTED_PROVIDERS.has(provider) ? provider : 'disabled';
  const minimaxRegion = resolveMinimaxRegion(env);
  const defaultEndpoint = selected === 'free' || selected === 'wikipedia' || selected === 'disabled' ? null
    : selected === 'searxng' ? (env.NARRATIVE_WEB_SEARCH_ENDPOINT?.trim() || env.SEARXNG_BASE_URL?.trim() || null)
    : selected === 'minimax' ? MINIMAX_SEARCH_ENDPOINTS[minimaxRegion]
    : DEFAULT_ENDPOINTS[selected] ?? null;
  return {
    provider: selected,
    endpoint: env.NARRATIVE_WEB_SEARCH_ENDPOINT?.trim() || defaultEndpoint,
    api_key: env.NARRATIVE_WEB_SEARCH_API_KEY?.trim()
      || (selected === 'firecrawl' ? env.FIRECRAWL_API_KEY
        : selected === 'exa' ? env.EXA_API_KEY
        : selected === 'tavily' ? env.TAVILY_API_KEY
        : selected === 'jina_search' ? env.JINA_API_KEY
        : selected === 'brave' ? env.BRAVE_SEARCH_API_KEY
        : selected === 'mcp_bridge' ? env.SERPER_API_KEY
        : selected === 'minimax' ? (env.MINIMAX_CODE_PLAN_KEY?.trim() || env.MINIMAX_CODING_API_KEY?.trim() || env.MINIMAX_OAUTH_TOKEN?.trim() || env.MINIMAX_API_KEY?.trim() || null)
        : null)
      || null,
    timeout_ms: boundedInt(env.NARRATIVE_WEB_SEARCH_TIMEOUT_MS, 20_000, 1_000, 120_000),
    max_results_per_query: boundedInt(env.NARRATIVE_WEB_SEARCH_MAX_RESULTS, 8, 1, 20),
    region: env.NARRATIVE_WEB_SEARCH_REGION?.trim() || null,
    safe_search: parseSafeSearch(env.NARRATIVE_WEB_SEARCH_SAFESEARCH),
    searxng_categories: env.SEARXNG_CATEGORIES?.trim() || null,
    searxng_language: env.SEARXNG_LANGUAGE?.trim() || null,
    minimax_region: minimaxRegion,
  };
}

type SearchRow = { title?: string; url?: string; snippet?: string; source_name?: string; published_at?: string | null };

export class HttpWebSearchProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async search(input: { query: string; config: WebSearchConfig; sourceDomains?: string[] }): Promise<SearchRow[]> {
    const { config, query, sourceDomains } = input;
    if (!config.endpoint && !KEYLESS_PROVIDERS.has(config.provider)) return [];
    if (config.provider === 'free') return this.free(query, config, sourceDomains);
    if (config.provider === 'wikipedia') return this.wikipedia(query, config);
    if (config.provider === 'hn') return this.hn(query, config);
    if (config.provider === 'duckduckgo') return this.duckduckgo(query, config);
    if (config.provider === 'reddit') return this.reddit(query, config);
    if (config.provider === 'arxiv') return this.arxiv(query, config);
    if (config.provider === 'openalex') return this.openalex(query, config);
    if (config.provider === 'archive') return this.archive(query, config);
    if (config.provider === 'bing') return this.bing(query, config);
    if (config.provider === 'gdelt') return this.gdelt(query, config);
    if (config.provider === 'brave') return this.brave(query, config, sourceDomains);
    if (config.provider === 'tavily') return this.tavily(query, config, sourceDomains);
    if (config.provider === 'minimax') return this.minimax(query, config);
    if (config.provider === 'searxng') return this.searxng(query, config);
    if (config.provider === 'exa') return this.exa(query, config, sourceDomains);
    if (config.provider === 'jina_search') return this.jinaSearch(query, config);
    if (config.provider === 'firecrawl') return this.firecrawl(query, config);
    if (config.provider === 'yahoo_finance') return this.yahooFinance(query, config);
    if (config.provider === 'eastmoney') return this.eastmoney(query, config);
    if (config.provider === 'x_twitter') return this.xTwitter(query, config);
    return this.mcpBridge(query, config, sourceDomains);
  }

  /** Aggregates every keyless source (GDELT, Wikipedia zh+en, Hacker News,
   *  DuckDuckGo HTML, Bing RSS, Reddit, arXiv, OpenAlex, Internet Archive)
   *  into one deduplicated result set so a single query surfaces many more
   *  leads than any one free source alone. */
  private async free(query: string, config: WebSearchConfig, sourceDomains?: string[]): Promise<SearchRow[]> {
    const sources = [
      this.gdelt(query, { ...config, endpoint: DEFAULT_ENDPOINTS.gdelt as string }),
      this.wikipedia(query, config),
      this.hn(query, { ...config, endpoint: DEFAULT_ENDPOINTS.hn as string }),
      this.duckduckgo(query, { ...config, endpoint: DEFAULT_ENDPOINTS.duckduckgo as string }),
      this.bing(query, { ...config, endpoint: DEFAULT_ENDPOINTS.bing as string }),
      // Keep broad discovery intact, then add a bounded official-domain pass.
      // The latter is the bridge from a market/theme query to a retrievable
      // primary page; it is never itself formal Evidence.
      ...(sourceDomains?.length ? [this.bing(query, { ...config, endpoint: DEFAULT_ENDPOINTS.bing as string }, sourceDomains)] : []),
      this.reddit(query, { ...config, endpoint: DEFAULT_ENDPOINTS.reddit as string }),
      this.arxiv(query, { ...config, endpoint: DEFAULT_ENDPOINTS.arxiv as string }),
      this.openalex(query, { ...config, endpoint: DEFAULT_ENDPOINTS.openalex as string }),
      this.archive(query, { ...config, endpoint: DEFAULT_ENDPOINTS.archive as string }),
    ];
    const settled = await Promise.allSettled(sources);
    const rows = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const seen = new Set<string>();
    const grouped = new Map<string, SearchRow[]>();
    for (const row of rows) {
      if (!row.url || seen.has(row.url)) continue;
      seen.add(row.url);
      const key = row.source_name ?? 'source';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }
    // Round-robin across sources instead of concatenating per source: the
    // per-query max_results cap in normalizeWebResearchLeads keeps the first
    // rows, so a naive concat would let whichever source happens to come
    // first (e.g. Wikipedia when GDELT/zh-Wikipedia fail) crowd out every
    // other free source and starve the aggregate of diversity.
    const merged: SearchRow[] = [];
    let any = true;
    while (any) {
      any = false;
      for (const group of grouped.values()) {
        if (group.length) {
          merged.push(group.shift() as SearchRow);
          any = true;
        }
      }
    }
    return merged;
  }

  /** MediaWiki REST full-text search against zh + en Wikipedia. No key needed. */
  private async wikipedia(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    const limit = String(config.max_results_per_query);
    const settled = await Promise.allSettled(['zh', 'en'].map(async (lang) => {
      const url = new URL(`https://${lang}.wikipedia.org/w/rest.php/v1/search/page`);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', limit);
      const body = await this.request(url.toString(), { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/1.0' } }, config.timeout_ms);
      const value = JSON.parse(body) as { pages?: Array<{ title?: string; key?: string; excerpt?: string }> };
      return (value.pages ?? []).map((page) => ({
        title: page.title,
        url: page.key ? `https://${lang}.wikipedia.org/wiki/${page.key}` : undefined,
        snippet: page.excerpt,
        source_name: `Wikipedia (${lang})`,
        published_at: null,
      }));
    }));
    return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }

  /** Hacker News full-text search via the free Algolia index. */
  private async hn(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    const url = new URL(config.endpoint as string);
    url.searchParams.set('query', query);
    url.searchParams.set('hitsPerPage', String(config.max_results_per_query));
    url.searchParams.set('tags', 'story');
    const body = await this.request(url.toString(), { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/1.0' } }, config.timeout_ms);
    const value = JSON.parse(body) as { hits?: Array<{ title?: string; url?: string | null; story_text?: string | null; objectID?: string; created_at?: string }> };
    return (value.hits ?? []).map((hit) => ({
      title: hit.title,
      url: hit.url ?? (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : undefined),
      snippet: hit.story_text ?? undefined,
      source_name: 'Hacker News',
      published_at: hit.created_at ?? null,
    }));
  }

  /** DuckDuckGo non-JavaScript HTML search: keyless and experimental. It
   *  scrapes the organic result page (instead of the encyclopedic Instant
   *  Answer API) so discovery surfaces real web pages. Because this depends on
   *  HTML structure that can change without notice, parsing stays
   *  conservative: a structure change degrades to zero rows, never garbage. */
  private async duckduckgo(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    const url = new URL(config.endpoint as string);
    url.searchParams.set('q', query);
    if (config.region) url.searchParams.set('kl', config.region);
    url.searchParams.set('kp', config.safe_search === 'strict' ? '1' : config.safe_search === 'off' ? '-2' : '-1');
    const body = await this.request(url.toString(), { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/1.0 (research bot)' } }, config.timeout_ms);
    // Each organic result starts with an <h2 class="result__title"> block.
    const segments = body.split(/<h2[^>]*class="[^"]*result__title[^"]*"[^>]*>/i).slice(1);
    const rows: SearchRow[] = [];
    for (const segment of segments) {
      if (rows.length >= config.max_results_per_query) break;
      const link = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(segment);
      if (!link) continue;
      const target = resolveDuckDuckGoUrl(link[1]);
      if (!/^https?:\/\//i.test(target)) continue;
      const snippet = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(segment)?.[1]
        ?? /<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(segment)?.[1]
        ?? '';
      let domain = 'DuckDuckGo';
      try { domain = new URL(target).hostname; } catch { /* row filtered by normalizer */ }
      rows.push({
        title: plainText(link[2]),
        url: target,
        snippet: plainText(snippet).slice(0, 800),
        source_name: domain,
        published_at: null,
      });
    }
    return rows;
  }

  /** MiniMax Token Plan search: keyed, structured results (title, URL,
   *  snippet). Matches the OpenClaw MiniMax web-search provider contract:
   *  POST the `{ q }` body (not `query`), read `organic` results with
   *  `link`/`date` fields, and treat a non-zero `base_resp.status_code`
   *  as an API-level failure. The host is chosen by minimax_region
   *  (global → minimax.io, cn → minimaxi.com). */
  private async minimax(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    if (!config.api_key) return [];
    const body = await this.request(config.endpoint as string, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${config.api_key}` },
      body: JSON.stringify({ q: query }),
    }, config.timeout_ms);
    const value = JSON.parse(body) as Record<string, unknown>;
    const baseResp = value.base_resp;
    if (baseResp && typeof baseResp === 'object') {
      const statusCode = (baseResp as Record<string, unknown>).status_code;
      if (typeof statusCode === 'number' && statusCode !== 0) {
        const message = searchString((baseResp as Record<string, unknown>).status_msg);
        throw new Error(`minimax_search_status_${statusCode}${message ? `: ${message}` : ''}`);
      }
    }
    return minimaxResultRows(value).slice(0, config.max_results_per_query).flatMap((item) => {
      const title = searchString(item.title);
      const url = searchString(item.link ?? item.url);
      if (!title || !url) return [];
      let domain = 'MiniMax Search';
      try { domain = new URL(url).hostname; } catch { /* row filtered by normalizer */ }
      return [{
        title,
        url,
        snippet: (searchString(item.snippet) ?? searchString(item.content) ?? '').slice(0, 800),
        source_name: searchString(item.source_name) ?? domain,
        published_at: searchString(item.date ?? item.published_at) ?? null,
      }];
    });
  }

  /** SearXNG self-hosted metagsearch JSON API: keyless and privacy-friendly.
   *  http:// base URLs are restricted to loopback/private hosts (SSRF guard);
   *  public instances must use https://. */
  private async searxng(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    const baseUrl = config.endpoint as string;
    const categories = config.searxng_categories?.trim() || 'general';
    const rows = await this.searxngFetch(baseUrl, query, categories, config);
    // Category fallback: a non-general category returning nothing retries once
    // with general before reporting an empty set.
    if (!rows.length && categories !== 'general') return this.searxngFetch(baseUrl, query, 'general', config);
    return rows;
  }

  private async searxngFetch(baseUrl: string, query: string, categories: string, config: WebSearchConfig): Promise<SearchRow[]> {
    assertSearxngBaseUrl(baseUrl);
    const url = new URL(`${baseUrl.replace(/\/+$/, '')}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('categories', categories);
    if (config.searxng_language) url.searchParams.set('language', config.searxng_language);
    const body = await this.request(url.toString(), { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/1.0' } }, config.timeout_ms);
    const value = JSON.parse(body) as { results?: Array<{ title?: string; url?: string; content?: string; publishedDate?: string; engine?: string }> };
    return (value.results ?? []).slice(0, config.max_results_per_query).flatMap((item) => {
      const title = item.title?.trim();
      const url = item.url?.trim();
      if (!title || !url) return [];
      let domain = 'SearXNG';
      try { domain = new URL(url).hostname; } catch { /* row filtered by normalizer */ }
      return [{
        title,
        url,
        snippet: (item.content ?? '').trim().slice(0, 800),
        source_name: item.engine?.trim() || domain,
        published_at: validDate(item.publishedDate) ? item.publishedDate as string : null,
      }];
    });
  }

  /** Bing's public RSS representation supplies general-web discovery without
   * a credential. It is still only a discovery feed: every returned URL must
   * pass the original-page retrieval and citation gate before Intake. */
  private async bing(query: string, config: WebSearchConfig, sourceDomains?: string[]): Promise<SearchRow[]> {
    const url = new URL(config.endpoint as string);
    const scopedDomains = [...new Set(sourceDomains ?? [])]
      .filter((domain) => /^[a-z0-9.-]+$/i.test(domain))
      .slice(0, 3);
    const siteScope = scopedDomains.length
      ? ` (${scopedDomains.map((domain) => `site:${domain}`).join(' OR ')})`
      : '';
    url.searchParams.set('q', `${query}${siteScope}`);
    url.searchParams.set('format', 'rss');
    const body = await this.request(url.toString(), { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/1.0' } }, config.timeout_ms);
    const items = body.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    // Bing RSS often ignores non-English queries and returns unrelated
    // content (Windows 10 tutorials, SEO spam, its own version page). Gate
    // general results on sharing a query token; official-domain site: passes
    // are already deliberately scoped and stay unfiltered.
    const queryTokens = bingRssQueryTokens(query);
    const scoped = scopedDomains.length > 0;
    return items.slice(0, config.max_results_per_query).flatMap((item) => {
      const title = xmlText(item, 'title');
      const link = xmlText(item, 'link');
      if (!title || !link) return [];
      const snippet = xmlText(item, 'description') ?? '';
      if (isBingRssJunk(title, link)) return [];
      // A result counts as query-related when its title OR snippet shares a
      // query token. This drops Bing's unrelated filler (Windows 10 tutorials
      // for Chinese BCI queries) while keeping relevant pages whose titles
      // paraphrase the query (e.g. an official notice whose snippet quotes
      // the policy term).
      const sharesToken = queryTokens.length
        && (queryTokens.some((token) => title.toLowerCase().includes(token))
          || queryTokens.some((token) => snippet.toLowerCase().includes(token)));
      if (!scoped && queryTokens.length && !sharesToken) return [];
      return [{ title, url: link, snippet, source_name: 'Bing RSS', published_at: xmlText(item, 'pubDate') ?? null }];
    });
  }

  /** Reddit full-text search: community narratives, discussion threads, and
   *  first-hand accounts. Free and keyless; a descriptive User-Agent is
   *  required to avoid aggressive rate limiting. */
  private async reddit(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    const url = new URL(config.endpoint as string);
    url.searchParams.set('q', query);
    url.searchParams.set('sort', 'relevance');
    url.searchParams.set('limit', String(config.max_results_per_query));
    url.searchParams.set('raw_json', '1');
    const body = await this.request(url.toString(), { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/1.0 (research bot)' } }, config.timeout_ms);
    const value = JSON.parse(body) as {
      data?: { children?: Array<{ data?: { title?: string; permalink?: string; selftext?: string; subreddit_name_prefixed?: string; created_utc?: number } }> };
    };
    return (value.data?.children ?? []).flatMap(({ data }) => {
      if (!data?.title || !data.permalink) return [];
      return [{
        title: data.title,
        url: `https://www.reddit.com${data.permalink}`,
        snippet: data.selftext?.slice(0, 300) || undefined,
        source_name: data.subreddit_name_prefixed ?? 'Reddit',
        published_at: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : null,
      }];
    });
  }

  /** arXiv API: open-access preprints. Returns Atom XML; parsed with a small
   *  regex since the entry shape is fixed and no XML dependency is loaded. */
  private async arxiv(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    const url = new URL(config.endpoint as string);
    url.searchParams.set('search_query', `all:${query}`);
    url.searchParams.set('start', '0');
    url.searchParams.set('max_results', String(config.max_results_per_query));
    url.searchParams.set('sortBy', 'relevance');
    const body = await this.request(url.toString(), { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/1.0' } }, config.timeout_ms);
    const entries = body.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    return entries.map((entry) => {
      const text = (tag: string) => decodeEntities(entry.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? '');
      const id = text('id').trim() || text('guid').trim();
      return {
        title: text('title'),
        url: id || undefined,
        snippet: text('summary').replace(/\s+/g, ' ').slice(0, 400) || undefined,
        source_name: 'arXiv',
        published_at: text('published') || null,
      };
    }).filter((row) => row.title);
  }

  /** OpenAlex: aggregated scholarly works (journals and preprints, incl.
   *  arXiv). JSON, free, no key. Rebuilds the abstract from the inverted
   *  index so snippets carry real substance. */
  private async openalex(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    const url = new URL(config.endpoint as string);
    url.searchParams.set('search', query);
    url.searchParams.set('per-page', String(config.max_results_per_query));
    url.searchParams.set('select', 'id,title,publication_date,doi,abstract_inverted_index,primary_location');
    const body = await this.request(url.toString(), { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/1.0' } }, config.timeout_ms);
    const value = JSON.parse(body) as {
      results?: Array<{
        title?: string;
        doi?: string | null;
        publication_date?: string;
        abstract_inverted_index?: Record<string, number[]>;
        primary_location?: { source?: { display_name?: string } | null } | null;
      }>;
    };
    return (value.results ?? []).map((item) => ({
      title: item.title,
      // OpenAlex DOIs arrive either as '10.xxxx/yyy' or as a full URL already.
      url: item.doi ? (item.doi.startsWith('http') ? item.doi : `https://doi.org/${item.doi}`) : undefined,
      snippet: rebuildAbstract(item.abstract_inverted_index).slice(0, 400) || undefined,
      source_name: item.primary_location?.source?.display_name ?? 'OpenAlex',
      published_at: item.publication_date ?? null,
    }));
  }

  /** Internet Archive full-text catalog search: historical documents, archived
   *  web collections, and periodicals — a fit for the narrative-lifecycle
   *  lens that traces how a story evolved over time. */
  private async archive(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    const url = new URL(config.endpoint as string);
    url.searchParams.set('q', query);
    url.searchParams.set('rows', String(config.max_results_per_query));
    url.searchParams.set('fl[]', 'identifier');
    url.searchParams.set('fl[]', 'title');
    url.searchParams.set('fl[]', 'publicdate');
    url.searchParams.set('output', 'json');
    const body = await this.request(url.toString(), { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/1.0' } }, config.timeout_ms);
    const value = JSON.parse(body) as { response?: { docs?: Array<{ identifier?: string; title?: string; publicdate?: string }> } };
    return (value.response?.docs ?? []).map((item) => ({
      title: item.title,
      url: item.identifier ? `https://archive.org/details/${item.identifier}` : undefined,
      snippet: '',
      source_name: 'Internet Archive',
      published_at: item.publicdate ?? null,
    }));
  }

  private async gdelt(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    const url = new URL(config.endpoint as string);
    url.searchParams.set('query', query);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('format', 'json');
    url.searchParams.set('maxrecords', String(config.max_results_per_query));
    url.searchParams.set('sort', 'hybridrel');
    const body = await this.request(url.toString(), { method: 'GET' }, config.timeout_ms);
    const value = JSON.parse(body) as { articles?: Array<{ title?: string; url?: string; seendate?: string; domain?: string }> };
    return (value.articles ?? []).map((item) => ({
      title: item.title,
      url: item.url,
      source_name: item.domain,
      published_at: item.seendate ?? null,
      snippet: '',
    }));
  }

  private async brave(query: string, config: WebSearchConfig, sourceDomains?: string[]) {
    const url = new URL(config.endpoint as string);
    const siteScope = sourceDomains?.slice(0, 3).map((domain) => `site:${domain}`).join(' OR ') ?? '';
    url.searchParams.set('q', `${query}${siteScope ? ` (${siteScope})` : ''}`);
    url.searchParams.set('count', String(config.max_results_per_query));
    const body = await this.request(url.toString(), { method: 'GET', headers: { Accept: 'application/json', 'X-Subscription-Token': config.api_key ?? '' } }, config.timeout_ms);
    const value = JSON.parse(body) as { web?: { results?: Array<{ title?: string; url?: string; description?: string; profile?: { long_name?: string } }> } };
    return (value.web?.results ?? []).map((item) => ({ title: item.title, url: item.url, snippet: item.description, source_name: item.profile?.long_name }));
  }

  private async tavily(query: string, config: WebSearchConfig, sourceDomains?: string[]) {
    const body = await this.request(config.endpoint as string, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${config.api_key ?? ''}` },
      body: JSON.stringify({ query, max_results: config.max_results_per_query, include_answer: false, include_raw_content: false, ...(sourceDomains?.length ? { include_domains: sourceDomains } : {}) }),
    }, config.timeout_ms);
    const value = JSON.parse(body) as { results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }> };
    return (value.results ?? []).map((item) => ({ title: item.title, url: item.url, snippet: item.content, published_at: item.published_date ?? null }));
  }

  private async mcpBridge(query: string, config: WebSearchConfig, sourceDomains?: string[]) {
    const body = await this.request(config.endpoint as string, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${config.api_key ?? ''}` },
      body: JSON.stringify({ query, max_results: config.max_results_per_query, ...(sourceDomains?.length ? { domains: sourceDomains } : {}) }),
    }, config.timeout_ms);
    const value = JSON.parse(body) as { results?: SearchRow[] };
    if (!Array.isArray(value.results)) throw new Error('mcp_bridge_response_missing_results');
    return value.results;
  }

  private async request(url: string, init: RequestInit, timeoutMs: number): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
        const body = await response.text();
        if (!response.ok) {
          // Free keyless sources rate-limit (429); retry transient failures
          // once before degrading, matching the project's direct-source rule.
          if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
            await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
            continue;
          }
          throw new Error(`web_search_http_${response.status}`);
        }
        return body;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error('web_search_retry_budget_exhausted');
  }

  private async exa(query: string, config: WebSearchConfig, sourceDomains?: string[]) {
    const body = await this.request(config.endpoint as string, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.api_key ?? '' },
      body: JSON.stringify({
        query,
        useAutoprompt: true,
        numResults: config.max_results_per_query,
        contents: { text: true },
        ...(sourceDomains?.length ? { includeDomains: sourceDomains } : {})
      }),
    }, config.timeout_ms);
    const value = JSON.parse(body) as { results?: Array<{ title?: string; url?: string; text?: string; publishedDate?: string }> };
    return (value.results ?? []).map((item) => ({ title: item.title, url: item.url, snippet: item.text?.slice(0, 500), published_at: item.publishedDate ?? null }));
  }

  private async jinaSearch(query: string, config: WebSearchConfig) {
    const url = `${config.endpoint as string}${encodeURIComponent(query)}`;
    const body = await this.request(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(config.api_key ? { Authorization: `Bearer ${config.api_key}` } : {})
      }
    }, config.timeout_ms);
    const value = JSON.parse(body) as { data?: Array<{ title?: string; url?: string; description?: string; content?: string }> };
    return (value.data ?? []).slice(0, config.max_results_per_query).map((item) => ({
      title: item.title,
      url: item.url,
      snippet: (item.description || item.content)?.slice(0, 500),
      published_at: null
    }));
  }

  private async firecrawl(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    if (!config.api_key) return [];
    const endpoint = config.endpoint || 'https://api.firecrawl.dev/v1/search';
    const body = await this.request(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        query,
        limit: config.max_results_per_query,
      }),
    }, config.timeout_ms);
    const value = JSON.parse(body) as { success?: boolean; data?: Array<{ title?: string; url?: string; description?: string; markdown?: string }> };
    if (!value.success || !Array.isArray(value.data)) return [];
    return value.data.map((item) => {
      let domain = 'web';
      try { if (item.url) domain = new URL(item.url).hostname; } catch {}
      return {
        title: item.title?.trim() || domain,
        url: item.url,
        snippet: (item.description?.trim() || item.markdown?.slice(0, 1000)?.trim() || '').slice(0, 1000),
        source_name: domain,
        published_at: null,
      };
    }).filter((item) => Boolean(item.url));
  }

  private async yahooFinance(query: string, config: WebSearchConfig) {
    // 1. Search for ticker
    const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=1&newsCount=0`;
    const searchBody = await this.request(searchUrl, { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/0.13' } }, config.timeout_ms);
    const searchData = JSON.parse(searchBody) as { quotes?: Array<{ symbol?: string; shortname?: string; longname?: string; exchDisp?: string }> };
    const ticker = searchData.quotes?.[0]?.symbol;
    
    if (!ticker) return [];
    
    // 2. Fetch quote data
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
    const quoteBody = await this.request(quoteUrl, { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/0.13' } }, config.timeout_ms);
    const quoteData = JSON.parse(quoteBody) as { quoteResponse?: { result?: Array<Record<string, any>> } };
    const result = quoteData.quoteResponse?.result?.[0];
    
    if (!result) return [];
    
    const name = result.longName || result.shortName || ticker;
    const price = result.regularMarketPrice;
    const change = result.regularMarketChangePercent;
    const marketCap = result.marketCap;
    
    const snippet = `Yahoo Finance Data for ${name} (${ticker} - ${result.fullExchangeName}): Price: ${price} ${result.currency} (${change > 0 ? '+' : ''}${change?.toFixed(2)}%), Market Cap: ${marketCap}, 52W Range: ${result.fiftyTwoWeekRange}, Volume: ${result.regularMarketVolume}.`;
    
    return [{
      title: `${name} (${ticker}) Financial Quote`,
      url: `https://finance.yahoo.com/quote/${ticker}`,
      snippet,
      published_at: null
    }];
  }

  private async eastmoney(query: string, config: WebSearchConfig) {
    // EastMoney A-shares quote data
    // Query should contain a 6-digit stock code
    const codeMatch = /[0-9]{6}/.exec(query);
    if (!codeMatch) return [];
    
    const code = codeMatch[0];
    const isSH = code.startsWith('6');
    const marketId = isSH ? '1' : '0';
    
    // Using EastMoney push2 API for basic quote data
    const url = `http://push2.eastmoney.com/api/qt/stock/get?secid=${marketId}.${code}&fields=f43,f44,f45,f46,f47,f48,f50,f57,f58,f59,f60,f162,f170`;
    
    const body = await this.request(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, config.timeout_ms);
    
    const response = JSON.parse(body) as { data?: any; rc?: number };
    if (response.rc !== 0 || !response.data) return [];
    
    const data = response.data;
    const name = data.f58 || 'Unknown';
    const close = data.f43 ? (data.f43 / 100).toFixed(2) : 'N/A';
    const prevClose = data.f60 ? (data.f60 / 100).toFixed(2) : 'N/A';
    const pe = data.f162 ? (data.f162 / 100).toFixed(2) : 'N/A';
    const pb = data.f170 ? (data.f170 / 100).toFixed(2) : 'N/A';
    const turnover = data.f168 ? (data.f168 / 100).toFixed(2) : 'N/A';
    
    const snippet = `A-Share Data (${name} ${code}): Close: ${close}, Prev Close: ${prevClose}, PE(TTM): ${pe}, PB: ${pb}, Turnover Rate: ${turnover}%`;
    
    return [{
      title: `EastMoney Data for ${name} (${code})`,
      url: `https://quote.eastmoney.com/${isSH ? 'sh' : 'sz'}${code}.html`,
      snippet,
      published_at: null
    }];
  }

  private async xTwitter(query: string, config: WebSearchConfig) {
    // Placeholder implementation for Twitter/X Search API (e.g. via RapidAPI or official v2 API).
    // The exact endpoint depends on the configured bridge. We assume a generic JSON response here.
    const endpoint = config.endpoint || 'https://api.twitter.com/2/tweets/search/recent';
    const url = new URL(endpoint);
    url.searchParams.append('query', query);
    url.searchParams.append('max_results', String(Math.min(config.max_results_per_query, 10)));
    
    const body = await this.request(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.api_key || ''}`,
        'Content-Type': 'application/json'
      }
    }, config.timeout_ms);
    
    const data = JSON.parse(body) as { data?: Array<{ id: string; text: string; created_at?: string }> };
    return (data.data || []).map(tweet => ({
      title: `Tweet ${tweet.id}`,
      url: `https://twitter.com/i/web/status/${tweet.id}`,
      snippet: tweet.text,
      published_at: tweet.created_at || null
    }));
  }
}

function boundedInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

/** DuckDuckGo HTML safe-search level; anything unrecognised falls back to
 *  the default 'moderate' (OpenClaw default). */
function parseSafeSearch(value: string | undefined): 'strict' | 'moderate' | 'off' {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'strict' || normalized === 'off' ? normalized : 'moderate';
}

/** MiniMax search region resolution: explicit MINIMAX_SEARCH_REGION wins,
 *  then the API host (MINIMAX_API_HOST / MINIMAX_BASE_URL) is inspected;
 *  the project's China-market default ('cn') applies when unset. */
function resolveMinimaxRegion(env: NodeJS.ProcessEnv): 'global' | 'cn' {
  const explicit = env.MINIMAX_SEARCH_REGION?.trim().toLowerCase();
  if (explicit === 'global' || explicit === 'cn') return explicit;
  const host = (env.MINIMAX_API_HOST ?? env.MINIMAX_BASE_URL ?? '').toLowerCase();
  if (host.includes('api.minimaxi.com')) return 'cn';
  if (host.includes('api.minimax.io')) return 'global';
  return 'cn';
}

/** DuckDuckGo HTML links are redirect URLs (//duckduckgo.com/l/?uddg=...);
 *  resolve to the real target so downstream retrieval fetches the original
 *  page instead of a redirect stub. */
function resolveDuckDuckGoUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  try {
    const url = new URL(href, 'https://html.duckduckgo.com/');
    return url.searchParams.get('uddg') ?? url.href;
  } catch {
    return href;
  }
}

/** Strips HTML tags and decodes the basic entities used by search pages. */
function plainText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Extracts the results array from the MiniMax search response. The
 *  documented shape uses `organic` (title/link/snippet/date); accept the
 *  common containers defensively. */
function minimaxResultRows(value: Record<string, unknown>): Array<Record<string, unknown>> {
  const candidates: unknown[] = Array.isArray(value.organic) ? value.organic
    : Array.isArray(value.results) ? value.results
    : (value.data && typeof value.data === 'object' && Array.isArray((value.data as Record<string, unknown>).results))
      ? (value.data as Record<string, unknown>).results as unknown[]
    : Array.isArray(value.items) ? value.items
    : [];
  return candidates.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
}

function searchString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** SSRF guard: http:// SearXNG base URLs must point at loopback or private
 *  hosts; public instances are required to use https://. */
function assertSearxngBaseUrl(value: string): void {
  const url = new URL(value);
  if (url.protocol === 'http:') {
    if (!isPrivateHost(url.hostname)) throw new Error('searxng_http_base_url_must_be_private_or_loopback');
  } else if (url.protocol !== 'https:') {
    throw new Error('unsupported_searxng_url_protocol');
  }
}

function isPrivateHost(host: string): boolean {
  const lower = host.toLowerCase();
  return lower === 'localhost' || lower.endsWith('.local')
    || /^127\.|^0\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(lower) || lower === '::1';
}

function validDate(value: string | null | undefined): boolean {
  return Boolean(value && !Number.isNaN(Date.parse(value)));
}

/** Minimal XML entity decoding for the fixed-shape Atom payloads we consume. */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function xmlText(source: string, tag: string): string | null {
  const value = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(source)?.[1]?.trim() ?? '';
  return value ? decodeEntities(value.replace(/^<!\[CDATA\[|\]\]>$/g, '')) : null;
}

/** Drops Bing RSS self pages and the SEO spam it mirrors when it fails to
 *  match the query ("How To See All Bing Related Searches" appears on many
 *  domains; bing.com/version is Bing's own empty page). */
function isBingRssJunk(title: string, url: string): boolean {
  try {
    if (new URL(url).hostname === 'www.bing.com') return true;
  } catch { /* malformed link is filtered by the normalizer */ }
  return /bing related searches/i.test(title);
}

/** Significant query tokens for the Bing RSS relevance gate: contiguous CJK
 *  runs and English words of 3+ letters. Bing RSS frequently ignores
 *  non-English queries, so a result must share at least one of these to be
 *  considered query-related. */
function bingRssQueryTokens(query: string): string[] {
  const cjk = query.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const words = (query.match(/[a-zA-Z]{3,}/g) ?? []).map((word) => word.toLowerCase());
  return [...cjk, ...words];
}

/** OpenAlex stores abstracts as { word: [positions] }; rebuild the original
 *  sentence order so the snippet reads like a real abstract. */
function rebuildAbstract(inverted: Record<string, number[]> | undefined): string {
  if (!inverted) return '';
  const words: Array<{ word: string; pos: number }> = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const pos of positions) words.push({ word, pos });
  }
  return words.sort((a, b) => a.pos - b.pos).map((w) => w.word).join(' ');
}

