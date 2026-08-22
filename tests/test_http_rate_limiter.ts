import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DomainRateLimiter, rateLimitedFetch } from '@/platform/io/http_rate_limiter';

describe('DomainRateLimiter & rateLimitedFetch', () => {
  beforeEach(() => {
    DomainRateLimiter.resetInstance();
    vi.restoreAllMocks();
  });

  it('correctly maps government, financial, and default domain rules', () => {
    const limiter = DomainRateLimiter.getInstance();

    const govRule = limiter.getRuleForHost('sousuo.www.gov.cn');
    expect(govRule.maxConcurrent).toBe(2);
    expect(govRule.minIntervalMs).toBe(300);

    const ctrRule = limiter.getRuleForHost('www.chinadrugtrials.org.cn');
    expect(ctrRule.maxConcurrent).toBe(2);
    expect(ctrRule.minIntervalMs).toBe(300);

    const emRule = limiter.getRuleForHost('reportapi.eastmoney.com');
    expect(emRule.maxConcurrent).toBe(5);
    expect(emRule.minIntervalMs).toBe(150);

    const defaultRule = limiter.getRuleForHost('api.example.com');
    expect(defaultRule.maxConcurrent).toBe(10);
    expect(defaultRule.minIntervalMs).toBe(50);
  });

  it('enforces concurrency token acquisition and release', async () => {
    const limiter = DomainRateLimiter.getInstance();
    const release1 = await limiter.acquire('https://sousuo.www.gov.cn/data1');
    const release2 = await limiter.acquire('https://sousuo.www.gov.cn/data2');

    let thirdAcquired = false;
    const thirdPromise = limiter.acquire('https://sousuo.www.gov.cn/data3').then((rel) => {
      thirdAcquired = true;
      return rel;
    });

    // Since maxConcurrent is 2, third should be waiting in queue
    expect(thirdAcquired).toBe(false);

    release1();
    const release3 = await thirdPromise;
    expect(thirdAcquired).toBe(true);

    release2();
    release3();
  });

  it('automatically retries on HTTP 429 with exponential backoff and succeeds', async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return new Response('Too Many Requests', {
          status: 429,
          headers: { 'Retry-After': '0' },
        });
      }
      return new Response(JSON.stringify({ status: 'ok', data: [1, 2, 3] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    try {
      const res = await rateLimitedFetch('https://api.test-rate-limit.com/feed', undefined, {
        maxRetries: 3,
        initialBackoffMs: 10,
        maxBackoffMs: 50,
      });

      expect(res.status).toBe(200);
      expect(callCount).toBe(3);
      const json = await res.json();
      expect(json.status).toBe('ok');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fails gracefully when retries are exhausted on persistent 429', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response('Rate limited permanently', {
        status: 429,
        headers: { 'Retry-After': '0' },
      });
    });

    try {
      const res = await rateLimitedFetch('https://api.test-rate-limit.com/blocked', undefined, {
        maxRetries: 2,
        initialBackoffMs: 5,
        maxBackoffMs: 10,
      });
      // After exhausting retries, it returns the final 429 response
      expect(res.status).toBe(429);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
