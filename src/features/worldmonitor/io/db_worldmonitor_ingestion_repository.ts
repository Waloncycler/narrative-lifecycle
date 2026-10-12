import { db } from '@/db/index';
import { collectionAttempts, rawSnapshots } from '@/db/schema';
import type { WorldMonitorFetchResult } from '@/features/worldmonitor/io/worldmonitor_http_client';

export class DbWorldMonitorIngestionRepository {
  async saveFetchResults(results: WorldMonitorFetchResult[]): Promise<void> {
    const attemptRows = results.map((res) => {
      let duration = '0';
      if (res.payload) {
        duration = '1.0';
      }
      return {
        source_id: res.descriptor.operation_id,
        operation_id: res.descriptor.operation_id,
        started_at: res.payload?.fetched_at ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_sec: duration,
        status: res.status,
        http_status_code: res.httpStatus,
        snapshots_new: res.status === 'ok' && res.payload ? 1 : 0,
        snapshots_dup: res.status === 'skipped' ? 1 : 0,
        cursor_before: null,
        cursor_after: null,
        error_msg: res.status === 'failed' ? res.message : null,
        is_failure: res.status === 'failed' ? 1 : 0,
      };
    });

    if (attemptRows.length > 0) {
      await db.insert(collectionAttempts).values(attemptRows).execute();
    }

    const payloadRows = results
      .filter((res) => res.status === 'ok' && res.payload)
      .map((res) => {
        const payload = res.payload!;
        let rawBody = '';
        let contentType = 'json';
        if (typeof payload.body === 'object' && payload.body !== null) {
          if ('__xml' in payload.body) {
            rawBody = String(payload.body.__xml);
            contentType = 'xml';
          } else if ('__html' in payload.body) {
            rawBody = String(payload.body.__html);
            contentType = 'html';
          } else if ('__raw_text' in payload.body) {
            rawBody = String(payload.body.__raw_text);
            contentType = 'text';
          } else {
            rawBody = JSON.stringify(payload.body);
            contentType = 'json';
          }
        } else {
          rawBody = String(payload.body);
          contentType = 'text';
        }

        return {
          source_id: payload.descriptor.operation_id,
          external_id: `${payload.descriptor.operation_id}_${payload.fetched_at}`,
          fetched_at: payload.fetched_at,
          source_published_at: null,
          raw_url: payload.source_url,
          content_type: contentType,
          raw_body: rawBody,
          content_hash: payload.payload_hash,
          normalized_evidence_id: null,
          created_at: new Date().toISOString(),
        };
      });

    if (payloadRows.length > 0) {
      await db.insert(rawSnapshots).values(payloadRows).execute();
    }
  }
}
