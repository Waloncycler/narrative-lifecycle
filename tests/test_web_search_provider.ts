import { describe, expect, it } from 'vitest';
import { HttpWebSearchProvider, webSearchConfigFromEnv } from '@/features/research/io/web_search_provider';

describe('web search provider config selection', () => {
  it('defaults to the keyless free aggregate when no search key is configured', () => {
    const config = webSearchConfigFromEnv({ MINIMAX_API_KEY: 'chat-only-key' });
    expect(config).toMatchObject({ provider: 'free', endpoint: null, api_key: null });
  });

  it('honours an explicit keyless provider without an endpoint', () => {
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'wikipedia' })).toMatchObject({ provider: 'wikipedia', endpoint: null });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'gdelt' })).toMatchObject({ provider: 'gdelt', endpoint: 'https://api.gdeltproject.org/api/v2/doc/doc' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'hn' })).toMatchObject({ provider: 'hn', endpoint: 'https://hn.algolia.com/api/v1/search' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'duckduckgo' })).toMatchObject({ provider: 'duckduckgo', endpoint: 'https://api.duckduckgo.com' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'reddit' })).toMatchObject({ provider: 'reddit', endpoint: 'https://www.reddit.com/search.json' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'arxiv' })).toMatchObject({ provider: 'arxiv', endpoint: 'https://export.arxiv.org/api/query' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'openalex' })).toMatchObject({ provider: 'openalex', endpoint: 'https://api.openalex.org/works' });
    expect(webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'archive' })).toMatchObject({ provider: 'archive', endpoint: 'https://archive.org/advancedsearch.php' });
  });

  it('auto-selects a keyed provider when its key is present', () => {
    expect(webSearchConfigFromEnv({ TAVILY_API_KEY: 't' })).toMatchObject({ provider: 'tavily' });
    expect(webSearchConfigFromEnv({ BRAVE_SEARCH_API_KEY: 'b' })).toMatchObject({ provider: 'brave' });
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

  it('parses DuckDuckGo instant answers and flattens nested related topics', async () => {
    const provider = new HttpWebSearchProvider(async () => new Response(JSON.stringify({
      Heading: 'BCI',
      AbstractText: 'abstract text',
      AbstractURL: 'https://en.wikipedia.org/wiki/BCI',
      RelatedTopics: [
        { Text: 'Related One - source', FirstURL: 'https://duckduckgo.com/1' },
        { Text: 'Nested', FirstURL: 'https://duckduckgo.com/2', Topics: [{ Text: 'Child - src', FirstURL: 'https://duckduckgo.com/3' }] },
      ],
    }), { status: 200 }));
    const config = webSearchConfigFromEnv({ NARRATIVE_WEB_SEARCH_PROVIDER: 'duckduckgo', NARRATIVE_WEB_SEARCH_MAX_RESULTS: '2' });
    const results = await provider.search({ query: 'bci', config });
    expect(results[0]).toMatchObject({ url: 'https://en.wikipedia.org/wiki/BCI' });
    // Cap applies after the abstract row: only the first related topic row survives.
    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({ title: 'Related One' });
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
});
