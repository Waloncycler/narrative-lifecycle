import { createHash } from 'node:crypto';
import type { WorldMonitorOperationDescriptor, WorldMonitorPayload, WorldMonitorSyncMode } from '@/features/worldmonitor/types/worldmonitor_adapter';
import { governanceForWorldMonitorOperation, isDegradedWorldMonitorPayload, isStaleWorldMonitorPayload } from '@/features/worldmonitor/domain/worldmonitor_rules';
import { normalizerIdForOperation } from '@/features/worldmonitor/domain/worldmonitor_normalizers';

export interface WorldMonitorFetchResult {
  descriptor: WorldMonitorOperationDescriptor;
  payload: WorldMonitorPayload | null;
  status: 'ok' | 'skipped' | 'failed';
  httpStatus: number | null;
  message: string;
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
    cacheHeaders?: { etag?: string; lastModified?: string },
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
    if (mode === 'live') {
      const jitterMs = Math.floor(Math.random() * 5000);
      await new Promise(resolve => setTimeout(resolve, jitterMs));
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
      if (mode === 'live') {
      const jitterMs = Math.floor(Math.random() * 5000);
      await new Promise(resolve => setTimeout(resolve, jitterMs));
    }

    if (descriptor.auth_requirement === 'worldmonitor_key' && this.apiKey) headers['X-WorldMonitor-Key'] = this.apiKey;
      if (descriptor.content_type) headers['Content-Type'] = descriptor.content_type;
      if (descriptor.request_headers) Object.assign(headers, descriptor.request_headers);
      if (cacheHeaders?.etag) headers['If-None-Match'] = cacheHeaders.etag;
      if (cacheHeaders?.lastModified) headers['If-Modified-Since'] = cacheHeaders.lastModified;
      if (descriptor.operation_id === 'DirectSinaFinance') {
        return await this.fetchSinaPages(descriptor, mode, headers);
      }
      const response = await this.fetchImpl(descriptor.production_url, {
        method: descriptor.method === 'POST' ? 'POST' : 'GET',
        headers,
        body: descriptor.method === 'POST' ? descriptor.post_body : undefined,
        signal: controller.signal,
      });
      if (response.status === 304) {
        return { descriptor, payload: null, status: 'skipped', httpStatus: 304, message: 'Resource not modified (304).' };
      }
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

  private async fetchSinaPages(
    descriptor: WorldMonitorOperationDescriptor,
    mode: WorldMonitorSyncMode,
    headers: Record<string, string>,
  ): Promise<WorldMonitorFetchResult> {
    const records: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    const maxPages = 20;
    let lastStatus = 200;
    let completedPages = 0;
    let partialError: string | null = null;
    // The live 7x24 endpoint exposes public readership but only a latest-item
    // window. Keep that window, then append the genuinely paginated roll feed
    // for broader coverage. Both remain secondary-source research leads.
    const currentController = new AbortController();
    const currentTimeout = setTimeout(() => currentController.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(descriptor.production_url, { headers, signal: currentController.signal });
      if (response.ok) {
        const json = JSON.parse(await response.text()) as Record<string, unknown>;
        const current = objectArrayForHttp(objectForHttp(objectForHttp(objectForHttp(json.result)?.data)?.feed)?.list);
        appendUniqueRecords(records, seen, current);
      }
    } finally {
      clearTimeout(currentTimeout);
    }
    for (let page = 1; page <= maxPages; page += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const url = new URL('https://feed.mix.sina.com.cn/api/roll/get');
      url.searchParams.set('pageid', '153');
      url.searchParams.set('lid', '2516');
      url.searchParams.set('page', String(page));
      url.searchParams.set('num', '50');
      try {
        const response = await this.fetchImpl(url.toString(), { headers, signal: controller.signal });
        lastStatus = response.status;
        if (!response.ok) throw new Error(`Sina Finance returned HTTP ${response.status} on page ${page}.`);
        const json = JSON.parse(await response.text()) as Record<string, unknown>;
        const pageRecords = objectArrayForHttp(objectForHttp(json.result)?.data);
        if (!pageRecords.length) break;
        appendUniqueRecords(records, seen, pageRecords);
        completedPages += 1;
      } catch (error) {
        partialError = error instanceof Error ? error.message : String(error);
        if (!records.length) throw error;
        break;
      } finally {
        clearTimeout(timeout);
      }
    }
    const fetchedAt = new Date().toISOString();
    return {
      descriptor,
      payload: payload(descriptor, fetchedAt, descriptor.production_url, mode, {
        result: { data: { feed: { list: records } } },
      }),
      status: 'ok',
      httpStatus: lastStatus,
      message: `Live response received from current readership window plus ${completedPages}/${maxPages} historical pages (${records.length} records)${partialError ? `; partial stop: ${partialError}` : ''}; research triage and Evidence admission remain separate.`,
    };
  }
}


function objectForHttp(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function objectArrayForHttp(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function appendUniqueRecords(target: Record<string, unknown>[], seen: Set<string>, incoming: Record<string, unknown>[]): void {
  for (const record of incoming) {
    const key = String(record.id ?? record.oid ?? record.docid ?? record.docurl ?? record.url ?? record.rich_text ?? record.title ?? '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    target.push(record);
  }
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
