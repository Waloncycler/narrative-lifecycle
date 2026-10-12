import { describe, expect, it } from 'vitest';
import { HttpWebSearchProvider } from '@/features/research/io/web_search_provider';
import { webSearchConfigFromEnv, webSearchConfigsFromEnv } from "@/features/research/io/web_search_provider";

describe('web search provider config selection', () => {
  it('defaults to the keyless free aggregate when no search key is configured', () => {
    const config = webSearchConfigFromEnv({ MINIMAX_API_KEY: 'chat-only-key' });
    expect(config).toMatchObject({ provider: 'free', endpoint: null, api_key: null });
  });
  it('honours an explicit keyless provider without an endpoint', () => {
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'wikipedia' })).toMatchObject({ provider: 'wikipedia', endpoint: null });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'gdelt' })).toMatchObject({ provider: 'gdelt', endpoint: 'https://api.gdeltproject.org/api/v2/doc/doc' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'hn' })).toMatchObject({ provider: 'hn', endpoint: 'https://hn.algolia.com/api/v1/search' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'duckduckgo' })).toMatchObject({ provider: 'duckduckgo', endpoint: 'https://html.duckduckgo.com/html/' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'reddit' })).toMatchObject({ provider: 'reddit', endpoint: 'https://www.reddit.com/search.json' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'arxiv' })).toMatchObject({ provider: 'arxiv', endpoint: 'https://export.arxiv.org/api/query' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'openalex' })).toMatchObject({ provider: 'openalex', endpoint: 'https://api.openalex.org/works' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'archive' })).toMatchObject({ provider: 'archive', endpoint: 'https://archive.org/advancedsearch.php' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'bing' })).toMatchObject({ provider: 'bing', endpoint: 'https://www.bing.com/search' });
  });

  it('auto-selects a keyed provider when its key is present', () => {
    expect(webSearchConfigFromEnv({ TAVILY_API_KEY: 't' })).toMatchObject({ provider: 'tavily' });
    expect(webSearchConfigFromEnv({ BRAVE_SEARCH_API_KEY: 'b' })).toMatchObject({ provider: 'brave' });
  });

  it('resolves searxng and minimax only when explicitly selected or clearly configured', () => {
    // Explicitly selected providers resolve their own endpoints and secrets.
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'searxng', SEARXNG_BASE_URL: 'https://search.example.org' }))
      .toMatchObject({ provider: 'searxng', endpoint: 'https://search.example.org', api_key: null });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'minimax', MINIMAX_OAUTH_TOKEN: 'oauth', MINIMAX_SEARCH_REGION: 'global' }))
      .toMatchObject({ provider: 'minimax', api_key: 'oauth', minimax_region: 'global', endpoint: 'https://api.minimax.io/v1/coding_plan/search' });
    // Key resolution order: CODE_PLAN → CODING_API → OAUTH → API.
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'minimax', MINIMAX_API_KEY: 'chat-only', MINIMAX_CODE_PLAN_KEY: 'plan-key' }).api_key).toBe('plan-key');
    // SearXNG auto-detects from its base URL; MiniMax only from a dedicated
    // search-plan key, never from the chat-completions MINIMAX_API_KEY.
    expect(webSearchConfigFromEnv({ SEARXNG_BASE_URL: 'http://127.0.0.1:8888' })).toMatchObject({ provider: 'searxng' });
    expect(webSearchConfigFromEnv({ MINIMAX_CODE_PLAN_KEY: 'plan-key' })).toMatchObject({ provider: 'minimax' });
    expect(webSearchConfigFromEnv({ MINIMAX_API_KEY: 'chat-only' })).toMatchObject({ provider: 'free' });
  });

  it('allows an explicit disabled and rejects unknown providers', () => {
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'disabled' })).toMatchObject({ provider: 'disabled' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'not-a-provider' })).toMatchObject({ provider: 'disabled' });
  });

  it('allows a local MCP bridge without a secret and normalizes its documented contract', async () => {
    let requestBody = '';
    const provider = new HttpWebSearchProvider(async (_input, init) => {
      requestBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ results: [{ title: '脑机接口实施意见', url: 'https://example.test/bci', snippet: '公开来源', source_name: 'Test source' }] }), { status: 200 });
    });
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'mcp_bridge', NARRATIVE_WEB_SEARCH_ENDPOINT: 'http://127.0.0.1:8787/search' });
    expect(config.api_key).toBeNull();
    const results = await provider.search({ query: '脑机接口', config });
    expect(JSON.parse(requestBody)).toMatchObject({ query: '脑机接口', max_results: 8 });
    expect(results[0]).toMatchObject({ title: '脑机接口实施意见', url: 'https://example.test/bci' });
  });
});

describe('webSearchConfigsFromEnv multi-engine sweep', () => {
  it('always includes the keyless free aggregate when nothing else is configured', () => {
    expect(webSearchConfigsFromEnv({}).map((config: any) => config.provider)).toEqual(['free']);
  });

  it('runs every configured engine together instead of replacing free', () => {
    const providers = webSearchConfigsFromEnv({
      TAVILY_API_KEY: 't',
      BRAVE_SEARCH_API_KEY: 'b',
      SEARXNG_BASE_URL: 'http://127.0.0.1:8888',
      MINIMAX_API_KEY: 'sk-cp-test',
    }).map((config: any) => config.provider);
    expect(providers).toEqual(['free', 'tavily', 'brave', 'searxng', 'minimax']);
  });

  it('treats MINIMAX_API_KEY as a usable search key in the sweep set', () => {
    const configs = webSearchConfigsFromEnv({ MINIMAX_API_KEY: 'sk-cp-test' });
    const minimax = configs.find((config: any) => config.provider === 'minimax');
    expect(minimax).toMatchObject({ provider: 'minimax', api_key: 'sk-cp-test', endpoint: 'https://api.minimaxi.com/v1/coding_plan/search' });
  });

  it('adds explicitly requested keyless engines as standalone passes', () => {
    const providers = webSearchConfigsFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDERS: 'duckduckgo,bing' }).map((config: any) => config.provider);
    expect(providers).toEqual(['free', 'duckduckgo', 'bing']);
  });

  it('deduplicates engines and honours the singular provider variable', () => {
    const providers = webSearchConfigsFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'minimax', MINIMAX_CODE_PLAN_KEY: 'plan' }).map((config: any) => config.provider);
    expect(providers).toEqual(['free', 'minimax']);
  });

  it('falls back to a disabled config only when explicitly disabled', () => {
    expect(webSearchConfigsFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'disabled' }).map((config: any) => config.provider)).toEqual(['disabled']);
    // An unknown explicit name still keeps the free aggregate on.
    expect(webSearchConfigsFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'not-a-provider' }).map((config: any) => config.provider)).toEqual(['free']);
  });
});

describe('web search provider keyless adapters', () => {
  it('aggregates free sources and deduplicates by url', async () => {
    const provider = new HttpWebSearchProvider(async (input) => {
      const url = String(input);
      if (url.includes('gdeltproject')) {
        return new Response(JSON.stringify({ articles: [
          { title: 'GDELT A', url: 'https://news.test/a', domain: 'news.test' },
          { title: 'GDELT B', url: 'https://news.test/b', domain: 'news.test' },
        ] }), { status: 200 });
      }
      if (url.includes('wikipedia.org')) {
        return new Response(JSON.stringify({ pages: [
          { title: 'Wiki A', key: 'Wiki_A', excerpt: 'wiki snippet' },
        ] }), { status: 200 });
      }
      if (url.includes('hn.algolia')) {
        return new Response(JSON.stringify({ hits: [
          { title: 'HN A', url: 'https://news.test/a', story_text: 'hn story', objectID: '1', created_at: '2026-01-01T00:00:00Z' },
        ] }), { status: 200 });
      }
      if (url.includes('duckduckgo')) {
        return new Response(JSON.stringify({ AbstractText: 'Wiki A abstract', AbstractURL: 'https://en.wikipedia.org/wiki/Wiki_A', Heading: 'Wiki A', RelatedTopics: [] }), { status: 200 });
      }
      if (url.includes('reddit.com')) {
        return new Response(JSON.stringify({ data: { children: [
          { data: { title: 'Reddit A', permalink: '/r/test/comments/1/x/reddit_a/', selftext: 'thread body', subreddit_name_prefixed: 'r/test', created_utc: 1700000000 } },
        ] } }), { status: 200 });
      }
      if (url.includes('arxiv.org')) {
        return new Response('<?xml version="1.0" encoding="UTF-8"?><feed><entry><id>http://arxiv.org/abs/2201.00001v1</id><title>arXiv A</title><summary>arXiv summary</summary><published>2022-01-01T00:00:00Z</published></entry></feed>', { status: 200 });
      }
      if (url.includes('openalex.org')) {
        return new Response(JSON.stringify({ results: [
          { title: 'OpenAlex A', doi: '10.1000/xyz', publication_date: '2024-05-01', abstract_inverted_index: { OpenAlex: [0], work: [1] }, primary_location: { source: { display_name: 'Nature' } } },
        ] }), { status: 200 });
      }
      if (url.includes('archive.org')) {
        return new Response(JSON.stringify({ response: { docs: [
          { identifier: 'hist-1990', title: 'Archive A', publicdate: '1990-01-01T00:00:00Z' },
        ] } }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'free' });
    const results = await provider.search({ query: 'A', config });
    const urls = results.map((row) => row.url);
    // Round-robin across sources: GDELT A (HN A dedupes onto it) + wiki zh +
    // wiki en (DDG abstract dedupes onto the same en URL) + Reddit + arXiv +
    // OpenAlex DOI + Archive, then GDELT B on the second pass.
    expect(urls).toEqual([
      'https://news.test/a',
      'https://zh.wikipedia.org/wiki/Wiki_A',
      'https://en.wikipedia.org/wiki/Wiki_A',
      'https://www.reddit.com/r/test/comments/1/x/reddit_a/',
      'http://arxiv.org/abs/2201.00001v1',
      'https://doi.org/10.1000/xyz',
      'https://archive.org/details/hist-1990',
      'https://news.test/b',
    ]);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('parses Wikipedia zh+en REST pages', async () => {
    const provider = new HttpWebSearchProvider(async (input) => {
      const url = String(input);
      const lang = url.includes('zh.wikipedia') ? 'zh' : 'en';
      return new Response(JSON.stringify({ pages: [{ title: `T-${lang}`, key: `T_${lang}`, excerpt: `excerpt-${lang}` }] }), { status: 200 });
    });
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'wikipedia' });
    const results = await provider.search({ query: '脑机接口', config });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ title: 'T-zh', url: 'https://zh.wikipedia.org/wiki/T_zh', source_name: 'Wikipedia (zh)' });
    expect(results[1]).toMatchObject({ title: 'T-en', url: 'https://en.wikipedia.org/wiki/T_en', source_name: 'Wikipedia (en)' });
  });

  it('parses Hacker News hits and falls back to the HN item url', async () => {
    const provider = new HttpWebSearchProvider(async () => new Response(JSON.stringify({ hits: [
      { title: 'With link', url: 'https://article.test/x', story_text: 'text', objectID: '11' },
      { title: 'No link', url: null, objectID: '22' },
    ] }), { status: 200 }));
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'hn' });
    const results = await provider.search({ query: 'x', config });
    expect(results[0]).toMatchObject({ title: 'With link', url: 'https://article.test/x' });
    expect(results[1]).toMatchObject({ title: 'No link', url: 'https://news.ycombinator.com/item?id=22' });
  });

  it('parses DuckDuckGo HTML results and resolves uddg redirect links', async () => {
    const html = `
      <div class="result results_links results_links_deep web-result">
        <div class="links_main links_deep result__body">
          <h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fbci-policy&amp;rut=abc">脑机接口 &amp; 政策 - Example</a></h2>
          <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fbci-policy&amp;rut=abc">2026 <b>政策</b> 文件。</a>
          <div class="result__extras"><a class="result__url" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fbci-policy&amp;rut=abc">example.com</a></div>
        </div>
      </div>
      <div class="result"><h2 class="result__title"><a class="result__a" href="https://direct.example.org/robot">Direct Link</a></h2></div>
      <div class="result"><h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fnews.example.net%2Fitem&amp;rut=def">Third Result</a></h2></div>`;
    const provider = new HttpWebSearchProvider(async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }));
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'duckduckgo', NARRATIVE_WEB_SEARCH_REGION: 'cn-zh', NARRATIVE_WEB_SEARCH_SAFESEARCH: 'strict', NARRATIVE_WEB_SEARCH_MAX_RESULTS: '2' });
    expect(config).toMatchObject({ region: 'cn-zh', safe_search: 'strict' });
    const results = await provider.search({ query: 'bci', config });
    // Max-results cap applies before the snippet/direct-link rows.
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ title: '脑机接口 & 政策 - Example', url: 'https://example.com/bci-policy', snippet: '2026 政策 文件。', source_name: 'example.com' });
    expect(results[1]).toMatchObject({ title: 'Direct Link', url: 'https://direct.example.org/robot' });
  });

  it('parses MiniMax Token Plan search results defensively', async () => {
    const provider = new HttpWebSearchProvider(async () => new Response(JSON.stringify({ data: { results: [
      { title: 'MiniMax Hit', url: 'https://search.test/mm', content: 'snippet text', published_at: '2026-07-01' },
      { title: 'Broken Row' },
      { title: 'MiniMax Two', url: 'https://search.test/mm2' },
    ] } }), { status: 200 }));
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'minimax', MINIMAX_CODE_PLAN_KEY: 'sk-cp-test' });
    expect(config).toMatchObject({ provider: 'minimax', api_key: 'sk-cp-test', endpoint: 'https://api.minimaxi.com/v1/coding_plan/search' });
    const results = await provider.search({ query: '脑机接口', config });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ title: 'MiniMax Hit', url: 'https://search.test/mm', snippet: 'snippet text', published_at: '2026-07-01' });
  });

  it('parses SearXNG JSON results, falls back to general, and guards http base URLs', async () => {
    const requested: string[] = [];
    const provider = new HttpWebSearchProvider(async (input) => {
      const url = String(input);
      requested.push(url);
      const categories = new URL(url).searchParams.get('categories');
      return new Response(JSON.stringify({ results: categories === 'general'
        ? [{ title: 'SearXNG General', url: 'https://search.test/sx', content: 'fallback hit', publishedDate: '2026-08-01T00:00:00Z', engine: 'google' }]
        : [] }), { status: 200 });
    });
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'searxng', SEARXNG_BASE_URL: 'http://localhost:8888', SEARXNG_CATEGORIES: 'news', SEARXNG_LANGUAGE: 'en' });
    expect(config).toMatchObject({ provider: 'searxng', endpoint: 'http://localhost:8888', searxng_categories: 'news', searxng_language: 'en' });
    const results = await provider.search({ query: 'bci', config });
    // news returned zero rows → one retry with general before giving up.
    expect(requested.filter((url) => url.includes('/search')).length).toBe(2);
    expect(requested.some((url) => new URL(url).searchParams.get('categories') === 'general')).toBe(true);
    expect(results[0]).toMatchObject({ title: 'SearXNG General', url: 'https://search.test/sx', published_at: '2026-08-01T00:00:00Z' });
    // Public http:// instance is refused by the SSRF guard.
    const publicConfig = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'searxng', SEARXNG_BASE_URL: 'http://searx.example.com' });
    await expect(provider.search({ query: 'bci', config: publicConfig })).rejects.toThrow('searxng_http_base_url_must_be_private_or_loopback');
  });

  it('parses credential-free Bing RSS general-web results', async () => {
    const provider = new HttpWebSearchProvider(async () => new Response(
      '<rss><channel><item><title><![CDATA[工信部发布原文]]></title><link>https://www.miit.gov.cn/article</link><description><![CDATA[政策正文]]></description><pubDate>Sat, 09 Aug 2026 00:00:00 GMT</pubDate></item></channel></rss>',
      { status: 200 },
    ));
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'bing' });
    const results = await provider.search({ query: '存储芯片 政策', config });
    expect(results[0]).toMatchObject({ title: '工信部发布原文', url: 'https://www.miit.gov.cn/article', snippet: '政策正文' });
  });

  it('adds a bounded official-domain Bing pass to the free aggregate', async () => {
    const requested: string[] = [];
    const provider = new HttpWebSearchProvider(async (input) => {
      const url = String(input);
      requested.push(url);
      if (url.includes('bing.com')) {
        return new Response('<rss><channel><item><title>官方原文</title><link>https://www.miit.gov.cn/article</link><description>可复核正文</description></item></channel></rss>', { status: 200 });
      }
      if (url.includes('wikipedia.org')) return new Response(JSON.stringify({ pages: [] }), { status: 200 });
      if (url.includes('gdeltproject')) return new Response(JSON.stringify({ articles: [] }), { status: 200 });
      if (url.includes('hn.algolia')) return new Response(JSON.stringify({ hits: [] }), { status: 200 });
      if (url.includes('duckduckgo')) return new Response(JSON.stringify({ RelatedTopics: [] }), { status: 200 });
      if (url.includes('reddit.com')) return new Response(JSON.stringify({ data: { children: [] } }), { status: 200 });
      if (url.includes('arxiv.org')) return new Response('<feed/>', { status: 200 });
      if (url.includes('openalex.org')) return new Response(JSON.stringify({ results: [] }), { status: 200 });
      if (url.includes('archive.org')) return new Response(JSON.stringify({ response: { docs: [] } }), { status: 200 });
      throw new Error(`unexpected fetch ${url}`);
    });
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'free' });
    const results = await provider.search({ query: '人形机器人', config, sourceDomains: ['miit.gov.cn', 'www.gov.cn'] });
    expect(results.some((item) => item.url === 'https://www.miit.gov.cn/article')).toBe(true);
    const scoped = requested.find((url) => url.includes('bing.com') && decodeURIComponent(url).includes('site:miit.gov.cn'));
    expect(scoped).toBeDefined();
  });

  it('retries a transient 429 once and then succeeds', async () => {
    let calls = 0;
    const provider = new HttpWebSearchProvider(async () => {
      calls += 1;
      return calls === 1
        ? new Response('rate limited', { status: 429 })
        : new Response(JSON.stringify({ hits: [{ title: 'Retried hit', url: 'https://article.test/r', objectID: '1' }] }), { status: 200 });
    });
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'hn' });
    const results = await provider.search({ query: 'x', config });
    expect(calls).toBe(2);
    expect(results[0]).toMatchObject({ title: 'Retried hit' });
  });

  it('surfaces the error when the retry also fails', async () => {
    const provider = new HttpWebSearchProvider(async () => new Response('busy', { status: 503 }));
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'hn' });
    await expect(provider.search({ query: 'x', config })).rejects.toThrow('web_search_http_503');
  });

  it('parses Reddit search posts with a canonical permalink url', async () => {
    const provider = new HttpWebSearchProvider(async () => new Response(JSON.stringify({ data: { children: [
      { data: { title: 'BCI in the news', permalink: '/r/neuroscience/comments/1a2b3/bci_in_the_news/', selftext: 'discussion body', subreddit_name_prefixed: 'r/neuroscience', created_utc: 1700000000 } },
      { data: { title: 'No permalink', selftext: 'x' } },
    ] } }), { status: 200 }));
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'reddit' });
    const results = await provider.search({ query: 'brain computer interface', config });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: 'BCI in the news',
      url: 'https://www.reddit.com/r/neuroscience/comments/1a2b3/bci_in_the_news/',
      snippet: 'discussion body',
      source_name: 'r/neuroscience',
      published_at: '2023-11-14T22:13:20.000Z',
    });
  });

  it('parses arXiv Atom XML and decodes entities', async () => {
    const provider = new HttpWebSearchProvider(async () => new Response(
      '<?xml version="1.0" encoding="UTF-8"?><feed><entry><id>http://arxiv.org/abs/2201.00001v1</id>'
      + '<published>2022-01-01T00:00:00Z</published><title>Brain &amp; Computer Interfaces</title>'
      + '<summary>We study brain-computer interfaces &amp; their market narratives.</summary></entry>'
      + '<entry><id>http://arxiv.org/abs/2201.00002v1</id><published>2022-01-02T00:00:00Z</published>'
      + '<title></title><summary>No title entry</summary></entry></feed>',
      { status: 200 },
    ));
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'arxiv' });
    const results = await provider.search({ query: 'brain computer interface', config });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: 'Brain & Computer Interfaces',
      url: 'http://arxiv.org/abs/2201.00001v1',
      source_name: 'arXiv',
      published_at: '2022-01-01T00:00:00Z',
    });
    expect(results[0].snippet).toContain('brain-computer interfaces & their market narratives');
  });

  it('parses OpenAlex works and rebuilds the abstract from the inverted index', async () => {
    const provider = new HttpWebSearchProvider(async () => new Response(JSON.stringify({ results: [
      {
        title: 'BCI Review',
        doi: '10.1000/xyz',
        publication_date: '2024-05-01',
        abstract_inverted_index: { Brain: [0], interfaces: [1], are: [2], evolving: [3] },
        primary_location: { source: { display_name: 'Nature' } },
      },
      {
        title: 'Full URL DOI Work',
        doi: 'https://doi.org/10.9999/full',
        publication_date: '2024-01-01',
        abstract_inverted_index: null,
        primary_location: null,
      },
      { title: 'No DOI Work', publication_date: '2024-01-01', abstract_inverted_index: null, primary_location: null },
    ] }), { status: 200 }));
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'openalex' });
    const results = await provider.search({ query: 'brain computer interface', config });
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      title: 'BCI Review',
      url: 'https://doi.org/10.1000/xyz',
      snippet: 'Brain interfaces are evolving',
      source_name: 'Nature',
      published_at: '2024-05-01',
    });
    // DOIs that already carry the full URL are not double-prefixed.
    expect(results[1]).toMatchObject({ title: 'Full URL DOI Work', url: 'https://doi.org/10.9999/full' });
    expect(results[2].url).toBeUndefined();
  });

  it('parses Internet Archive catalog docs into details urls', async () => {
    const provider = new HttpWebSearchProvider(async () => new Response(JSON.stringify({ response: { docs: [
      { identifier: 'history-of-bci-1995', title: 'History of BCI 1995', publicdate: '1995-06-01T00:00:00Z' },
    ] } }), { status: 200 }));
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'archive' });
    const results = await provider.search({ query: 'brain computer interface', config });
    expect(results[0]).toMatchObject({
      title: 'History of BCI 1995',
      url: 'https://archive.org/details/history-of-bci-1995',
      source_name: 'Internet Archive',
      published_at: '1995-06-01T00:00:00Z',
    });
  });

  it('resolves Tabbit browser configuration from environment and auto-detects endpoint', () => {
    expect(webSearchConfigFromEnv({ TABBIT_BASE_URL: 'http://localhost:9222', TABBIT_API_KEY: 'tabbit-key' })).toMatchObject({
      provider: 'tabbit',
      endpoint: 'http://localhost:9222',
      api_key: 'tabbit-key',
    });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'tabbit' })).toMatchObject({
      provider: 'tabbit',
      endpoint: 'http://127.0.0.1:9222',
      api_key: null,
    });
  });

  it('runs Tabbit browser search and normalizes search results', async () => {
    let capturedUrl = '';
    let capturedBody = '';
    let capturedAuth = '';

    const provider = new HttpWebSearchProvider(async (input, init) => {
      capturedUrl = String(input);
      capturedBody = String(init?.body ?? '');
      capturedAuth = String((init?.headers as Record<string, string>)?.Authorization ?? '');
      return new Response(JSON.stringify({
        results: [
          {
            title: 'Tabbit AI Agent Search Result',
            url: 'https://example.com/tabbit-news',
            snippet: 'Automated browsing discovery lead snippet',
            source_name: 'TechDaily',
            published_at: '2026-03-01T12:00:00Z',
          },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const config = webSearchConfigFromEnv({
      NARRATIVE_WEB_SEARCH_PROVIDER: 'tabbit',
      TABBIT_BASE_URL: 'http://127.0.0.1:9222',
      TABBIT_API_KEY: 'secret-tabbit-token',
    });

    const results = await provider.search({ query: '具身智能', config });
    expect(capturedUrl).toBe('http://127.0.0.1:9222/search');
    expect(capturedAuth).toBe('Bearer secret-tabbit-token');
    const parsedBody = JSON.parse(capturedBody);
    expect(parsedBody.query).toBe('具身智能');
    expect(parsedBody.max_results).toBe(8);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: 'Tabbit AI Agent Search Result',
      url: 'https://example.com/tabbit-news',
      snippet: 'Automated browsing discovery lead snippet',
      source_name: 'TechDaily',
      published_at: '2026-03-01T12:00:00Z',
    });
  });

  it('enforces SSRF protection for Tabbit HTTP endpoints', async () => {
    const provider = new HttpWebSearchProvider();
    const config = webSearchConfigFromEnv({
      NARRATIVE_WEB_SEARCH_PROVIDER: 'tabbit',
      TABBIT_BASE_URL: 'http://public-remote-domain.com:9222',
    });
    await expect(provider.search({ query: 'test', config })).rejects.toThrow('tabbit_http_base_url_must_be_private_or_loopback');
  });
});

