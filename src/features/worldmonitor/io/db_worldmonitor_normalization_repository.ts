import { db } from '@/db/index';
import { canonicalEvents, evidenceEventMembership, rawSnapshots } from '@/db/schema';
import { isNull, eq } from 'drizzle-orm';
import type { WorldMonitorNormalizedFact } from '@/features/worldmonitor/types/worldmonitor_adapter';
import type { CanonicalEvent } from '@/features/worldmonitor/types/worldmonitor_normalization';
import crypto from 'crypto';

export interface UnprocessedSnapshot {
  id: number;
  source_id: string;
  external_id: string;
  raw_body: string | null;
  content_type: string;
  fetched_at: string;
}

export class DbWorldMonitorNormalizationRepository {
  async fetchUnprocessedSnapshots(limit: number = 100): Promise<UnprocessedSnapshot[]> {
    return db.select({
      id: rawSnapshots.id,
      source_id: rawSnapshots.source_id,
      external_id: rawSnapshots.external_id,
      raw_body: rawSnapshots.raw_body,
      content_type: rawSnapshots.content_type,
      fetched_at: rawSnapshots.fetched_at,
    })
    .from(rawSnapshots)
    .where(isNull(rawSnapshots.normalized_evidence_id))
    .limit(limit)
    .all();
  }

  async saveNormalizedFact(snapshotId: number, fact: WorldMonitorNormalizedFact): Promise<CanonicalEvent> {
    const now = new Date().toISOString();
    
    // Generate event key based on title and date
    const dateStr = fact.event_at.split('T')[0] || now.split('T')[0];
    const rawKey = `${fact.title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${dateStr}`;
    const eventKey = crypto.createHash('sha256').update(rawKey).digest('hex').substring(0, 16);
    
    const evidenceId = `ev_${snapshotId}_${eventKey}`;

    // 1. Upsert Canonical Event
    let eventId: number;
    let canonicalRecord: CanonicalEvent;
    
    const existingEvent = db.select()
      .from(canonicalEvents)
      .where(eq(canonicalEvents.event_key, eventKey))
      .limit(1)
      .all();

    if (existingEvent.length > 0) {
      eventId = existingEvent[0].id;
      db.update(canonicalEvents)
        .set({ last_observed_at: now, updated_at: now })
        .where(eq(canonicalEvents.id, eventId))
        .run();

      canonicalRecord = {
        id: eventId,
        event_key: eventKey,
        title: existingEvent[0].title,
        normalized_title: existingEvent[0].normalized_title,
        canonical_url: existingEvent[0].canonical_url,
        first_observed_at: existingEvent[0].first_observed_at,
        last_observed_at: now,
        created_at: existingEvent[0].created_at,
        updated_at: now,
      };
    } else {
      const [newEvent] = db.insert(canonicalEvents).values({
        event_key: eventKey,
        title: fact.title,
        normalized_title: fact.title.toLowerCase(),
        canonical_url: fact.source_url,
        first_observed_at: fact.event_at || now,
        last_observed_at: now,
        created_at: now,
        updated_at: now,
      }).returning().all();
      eventId = newEvent.id;
      canonicalRecord = newEvent;
    }

    // 2. Link Evidence
    db.insert(evidenceEventMembership).values({
      evidence_id: evidenceId,
      event_id: eventId,
      match_method: 'title_date_hash',
      similarity: '1.0',
      joined_at: now,
    }).onConflictDoNothing().run();

    // 3. Update Snapshot
    db.update(rawSnapshots)
      .set({ normalized_evidence_id: evidenceId })
      .where(eq(rawSnapshots.id, snapshotId))
      .run();

    return canonicalRecord;
  }

  async markSnapshotFailed(snapshotId: number): Promise<void> {
    db.update(rawSnapshots)
      .set({ normalized_evidence_id: 'FAILED_PARSE' })
      .where(eq(rawSnapshots.id, snapshotId))
      .run();
  }
}
