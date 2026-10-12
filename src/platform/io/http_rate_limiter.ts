export interface RateLimitRule {
  maxConcurrent: number;
  minIntervalMs: number;
}

export interface RateLimitOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  timeoutMs?: number;
  customRule?: RateLimitRule;
}

interface DomainQueueState {
  activeCount: number;
  lastRequestTime: number;
  queue: Array<() => void>;
}

export class DomainRateLimiter {
  private static instance: DomainRateLimiter | null = null;
  private domainStates: Map<string, DomainQueueState> = new Map();

  private constructor() {}

  public static getInstance(): DomainRateLimiter {
    if (!DomainRateLimiter.instance) {
      DomainRateLimiter.instance = new DomainRateLimiter();
    }
    return DomainRateLimiter.instance;
  }

  public static resetInstance(): void {
    DomainRateLimiter.instance = null;
  }

  /**
   * Resolves the matching rate limit rule based on hostname.
   */
  public getRuleForHost(hostname: string): RateLimitRule {
    const lower = hostname.toLowerCase();

    // Chinese Government / Regulatory portals: strict pacing to prevent anti-scraping blocks
    if (lower.endsWith('.gov.cn') || lower.includes('chinadrugtrials.org.cn') || lower.includes('ccgp.gov.cn')) {
      return { maxConcurrent: 2, minIntervalMs: 300 };
    }

    // Financial disclosures & brokerage APIs
    if (
      lower.includes('eastmoney.com') ||
      lower.includes('cninfo.com.cn') ||
      lower.includes('dfcfw.com') ||
      lower.includes('baichuan') ||
      lower.includes('trendforce')
    ) {
      return { maxConcurrent: 5, minIntervalMs: 150 };
    }

    // Default general API rule
    return { maxConcurrent: 10, minIntervalMs: 50 };
  }

  private extractHost(urlStr: string): string {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname;
    } catch {
      return 'default';
    }
  }

  private getOrCreateState(host: string): DomainQueueState {
    let state = this.domainStates.get(host);
    if (!state) {
      state = {
        activeCount: 0,
        lastRequestTime: 0,
        queue: [],
      };
      this.domainStates.set(host, state);
    }
    return state;
  }

  /**
   * Acquires a concurrency token and enforces minIntervalMs spacing.
   */
  public async acquire(url: string, customRule?: RateLimitRule): Promise<() => void> {
    const host = this.extractHost(url);
    const rule = customRule ?? this.getRuleForHost(host);
    const state = this.getOrCreateState(host);

    if (state.activeCount >= rule.maxConcurrent) {
      await new Promise<void>((resolve) => {
        state.queue.push(resolve);
      });
    }

    state.activeCount++;

    // Enforce minimal time interval between requests to the same host
    const now = Date.now();
    const elapsed = now - state.lastRequestTime;
    if (elapsed < rule.minIntervalMs) {
      const waitMs = rule.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    state.lastRequestTime = Date.now();

    // Return the release function
    return () => {
      state.activeCount--;
      if (state.queue.length > 0) {
        const next = state.queue.shift();
        if (next) next();
      }
    };
  }

  /**
   * Executes a rate-limited fetch with automatic 429/503 exponential backoff & jitter.
   */
  public async fetch(
    url: string | URL | Request,
    init?: RequestInit,
    options: RateLimitOptions = {}
  ): Promise<Response> {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    const maxRetries = options.maxRetries ?? 3;
    const initialBackoffMs = options.initialBackoffMs ?? 500;
    const maxBackoffMs = options.maxBackoffMs ?? 4000;

    let attempt = 0;
    let backoff = initialBackoffMs;

    while (attempt <= maxRetries) {
      attempt++;
      const release = await this.acquire(urlString, options.customRule);

      try {
        const defaultHeaders: Record<string, string> = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };

        const mergedHeaders = init?.headers
          ? { ...defaultHeaders, ...(init.headers as Record<string, string>) }
          : defaultHeaders;

        let controller: AbortController | null = null;
        let timeoutId: any = null;

        if (options.timeoutMs && options.timeoutMs > 0) {
          controller = new AbortController();
          timeoutId = setTimeout(() => controller?.abort(), options.timeoutMs);
        }

        const signal = controller
          ? controller.signal
          : init?.signal;

        const res = await fetch(url, {
          ...init,
          headers: mergedHeaders,
          signal,
        });

        if (timeoutId) clearTimeout(timeoutId);

        // Check if rate limited or temporarily unavailable
        if ((res.status === 429 || res.status === 503) && attempt <= maxRetries) {
          const jitter = Math.random() * 200;
          const retryAfterHeader = res.headers.get('Retry-After');
          let delayMs = backoff + jitter;

          if (retryAfterHeader) {
            const parsedSeconds = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsedSeconds)) {
              delayMs = Math.max(delayMs, parsedSeconds * 1000);
            }
          }

          await new Promise((r) => setTimeout(r, Math.min(delayMs, maxBackoffMs)));
          backoff = Math.min(backoff * 2, maxBackoffMs);
          continue;
        }

        return res;
      } catch (err: any) {
        if (attempt > maxRetries || err.name === 'AbortError') {
          throw err;
        }
        const jitter = Math.random() * 200;
        await new Promise((r) => setTimeout(r, Math.min(backoff + jitter, maxBackoffMs)));
        backoff = Math.min(backoff * 2, maxBackoffMs);
      } finally {
        release();
      }
    }

    throw new Error(`Exceeded max retries (${maxRetries}) fetching ${urlString}`);
  }
}

/**
 * Universal rate-limited fetch helper.
 */
export async function rateLimitedFetch(
  url: string | URL | Request,
  init?: RequestInit,
  options?: RateLimitOptions
): Promise<Response> {
  return DomainRateLimiter.getInstance().fetch(url, init, options);
}
