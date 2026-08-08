import type { WebSearchConfig } from '@/features/research/types/web_research';

/** Search providers that require no API key or configuration: usable out of
 *  the box. `free` aggregates the keyless sources below into one result set. */
const KEYLESS_PROVIDERS = new Set<WebSearchConfig['provider']>(['free', 'gdelt', 'wikipedia', 'hn', 'duckduckgo', 'reddit', 'arxiv', 'openalex', 'archive']);
const SUPPORTED_PROVIDERS = new Set<WebSearchConfig['provider']>(['disabled', ...KEYLESS_PROVIDERS, 'brave', 'tavily', 'mcp_bridge']);

const DEFAULT_ENDPOINTS: Partial<Record<WebSearchConfig['provider'], string>> = {
  gdelt: 'https://api.gdeltproject.org/api/v2/doc/doc',
  brave: 'https://api.search.brave.com/res/v1/web/search',
  tavily: 'https://api.tavily.com/search',
  hn: 'https://hn.algolia.com/api/v1/search',
  duckduckgo: 'https://api.duckduckgo.com',
  reddit: 'https://www.reddit.com/search.json',
  arxiv: 'https://export.arxiv.org/api/query',
  openalex: 'https://api.openalex.org/works',
  archive: 'https://archive.org/advancedsearch.php',
};

export function webSearchConfigFromEnv(env: NodeJS.ProcessEnv): WebSearchConfig {
  const requested = env.NARRATIVE_WEB_SEARCH_PROVIDER?.trim().toLowerCase();
  const provider = (requested
    ?? (env.TAVILY_API_KEY ? 'tavily' : env.BRAVE_SEARCH_API_KEY ? 'brave' : env.SERPER_API_KEY ? 'mcp_bridge' : 'free')) as WebSearchConfig['provider'];
  const selected = SUPPORTED_PROVIDERS.has(provider) ? provider : 'disabled';
  const defaultEndpoint = selected === 'free' || selected === 'wikipedia' || selected === 'disabled' ? null : DEFAULT_ENDPOINTS[selected] ?? null;
  return {
    provider: selected,
    endpoint: env.NARRATIVE_WEB_SEARCH_ENDPOINT?.trim() || defaultEndpoint,
    api_key: env.NARRATIVE_WEB_SEARCH_API_KEY?.trim()
      || (selected === 'tavily' ? env.TAVILY_API_KEY : selected === 'brave' ? env.BRAVE_SEARCH_API_KEY : selected === 'mcp_bridge' ? env.SERPER_API_KEY : null)
      || null,
    timeout_ms: boundedInt(env.NARRATIVE_WEB_SEARCH_TIMEOUT_MS, 15_000, 1_000, 120_000),
    max_results_per_query: boundedInt(env.NARRATIVE_WEB_SEARCH_MAX_RESULTS, 8, 1, 20),
  };
}

type SearchRow = { title?: string; url?: string; snippet?: string; source_name?: string; published_at?: string | null };

export class HttpWebSearchProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async search(input: { query: string; config: WebSearchConfig; sourceDomains?: string[] }): Promise<SearchRow[]> {
    const { config, query, sourceDomains } = input;
    if (!config.endpoint && !KEYLESS_PROVIDERS.has(config.provider)) return [];
    if (config.provider === 'free') return this.free(query, config);
    if (config.provider === 'wikipedia') return this.wikipedia(query, config);
    if (config.provider === 'hn') return this.hn(query, config);
    if (config.provider === 'duckduckgo') return this.duckduckgo(query, config);
    if (config.provider === 'reddit') return this.reddit(query, config);
    if (config.provider === 'arxiv') return this.arxiv(query, config);
    if (config.provider === 'openalex') return this.openalex(query, config);
    if (config.provider === 'archive') return this.archive(query, config);
    if (config.provider === 'gdelt') return this.gdelt(query, config);
    if (config.provider === 'brave') return this.brave(query, config, sourceDomains);
    if (config.provider === 'tavily') return this.tavily(query, config, sourceDomains);
    return this.mcpBridge(query, config, sourceDomains);
  }

  /** Aggregates every keyless source (GDELT, Wikipedia zh+en, Hacker News,
   *  DuckDuckGo Instant Answer, Reddit, arXiv, OpenAlex, Internet Archive)
   *  into one deduplicated result set so a single query surfaces many more
   *  leads than any one free source alone. */
  private async free(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    const sources = [
      this.gdelt(query, { ...config, endpoint: DEFAULT_ENDPOINTS.gdelt as string }),
      this.wikipedia(query, config),
      this.hn(query, { ...config, endpoint: DEFAULT_ENDPOINTS.hn as string }),
      this.duckduckgo(query, { ...config, endpoint: DEFAULT_ENDPOINTS.duckduckgo as string }),
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

  /** DuckDuckGo Instant Answer API: free, keyless, but returns encyclopedic
   *  summaries and related topics rather than organic web results. */
  private async duckduckgo(query: string, config: WebSearchConfig): Promise<SearchRow[]> {
    const url = new URL(config.endpoint as string);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('no_html', '1');
    const body = await this.request(url.toString(), { method: 'GET', headers: { 'User-Agent': 'NarrativeLifecycleResearch/1.0' } }, config.timeout_ms);
    const value = JSON.parse(body) as {
      Heading?: string;
      AbstractText?: string;
      AbstractURL?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
    };
    const rows: SearchRow[] = [];
    if (value.AbstractText && value.AbstractURL) {
      rows.push({ title: value.Heading, url: value.AbstractURL, snippet: value.AbstractText, source_name: 'DuckDuckGo Instant Answer', published_at: null });
    }
    for (const topic of value.RelatedTopics ?? []) {
      const items = topic.Topics?.length ? topic.Topics : [topic];
      for (const item of items) {
        if (!item.Text || !item.FirstURL) continue;
        rows.push({ title: item.Text.split(' - ')[0], url: item.FirstURL, snippet: item.Text, source_name: 'DuckDuckGo Instant Answer', published_at: null });
        if (rows.length >= config.max_results_per_query) break;
      }
      if (rows.length >= config.max_results_per_query) break;
    }
    return rows;
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
}

function boundedInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
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
