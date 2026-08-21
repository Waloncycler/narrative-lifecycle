import { createServer } from 'http';
import { chromium, Browser } from 'playwright';

const PORT = 3000;
// Tabbit CDP port
const TABBIT_CDP_URL = 'http://127.0.0.1:9223';

let browserInstance: Browser | null = null;

async function getBrowser() {
  if (!browserInstance) {
    try {
      console.log(`[Tabbit Gateway] Connecting to REAL Tabbit browser at ${TABBIT_CDP_URL}...`);
      try {
        browserInstance = await chromium.connectOverCDP(TABBIT_CDP_URL);
        console.log('[Tabbit Gateway] Connected to Tabbit browser via CDP');
      } catch (e) {
        console.log('[Tabbit Gateway] CDP connection failed, launching local headless browser as fallback...');
        browserInstance = await chromium.launch({ headless: true });
      }
      console.log('[Tabbit Gateway] Connected successfully!');
    } catch (e) {
      console.error('[Tabbit Gateway] Failed to connect to Tabbit and failed to launch local browser.');
      throw e;
    }
  }
  return browserInstance;
}

import { Page } from 'playwright';

class PagePool {
  private pages: Page[] = [];
  private waiters: ((page: Page) => void)[] = [];
  private activeCount = 0;
  constructor(private maxConcurrent: number) {}

  async acquire(): Promise<Page> {
    if (this.pages.length > 0) return this.pages.pop()!;
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      const browser = await getBrowser();
      const context = browser.contexts()[0] || await browser.newContext();
      return await context.newPage();
    }
    return new Promise<Page>(resolve => this.waiters.push(resolve));
  }

  release(page: Page) {
    if (page.isClosed()) {
      this.activeCount--;
      // If a page died, let the next waiter acquire a fresh one by simulating a release
      if (this.waiters.length > 0) {
        this.acquire().then(newPage => {
          const next = this.waiters.shift();
          if (next) next(newPage);
        }).catch(console.error);
      }
      return;
    }
    if (this.waiters.length > 0) {
      const next = this.waiters.shift();
      if (next) next(page);
    } else {
      this.pages.push(page);
    }
  }
}
const pagePool = new PagePool(2); // Limit to 2 reusable concurrent tabs

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url?.endsWith('/search')) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const query = payload.query || payload.q || '';
        const limit = parseInt(payload.limit || payload.max_results || '10', 10);
        
        console.log(`[Tabbit Gateway] REAL Search requested for: "${query}"`);
        
        const page = await pagePool.acquire();
        try {
          console.log('[Tabbit Gateway] Navigating and searching via Bing in Tabbit...');
          await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
          
          const rawResults = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.b_algo'));
            return items.map(item => {
              const titleEl = item.querySelector('h2');
              const linkEl = item.querySelector('h2 a');
              const snippetEl = item.querySelector('.b_caption p, .b_algoSlug');
              return {
                title: titleEl?.textContent?.trim() || '',
                url: linkEl?.getAttribute('href') || '',
                snippet: snippetEl?.textContent?.trim() || '',
                source_name: 'Bing via Tabbit',
                published_at: new Date().toISOString()
              };
            });
          });

          // Do NOT close the page, so it can be reused without flashing!
          const results = rawResults.filter(r => r.title && r.url).slice(0, limit);
          console.log(`[Tabbit Gateway] Found ${results.length} real results for "${query}"`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ results }));
        } finally {
          pagePool.release(page);
        }
      } catch (err: any) {
        console.error('[Tabbit Gateway] Error during search:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Search failed', details: err.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Tabbit Gateway] REAL Automation Gateway listening on http://127.0.0.1:${PORT}`);
  console.log(`[Tabbit Gateway] Routing /search requests to Tabbit CDP on ${TABBIT_CDP_URL}`);
});
