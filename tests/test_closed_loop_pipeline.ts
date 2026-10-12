import { describe, expect, it } from 'vitest';
import { db } from '@/db/index';
import { rawSnapshots, canonicalEvents } from '@/db/schema';
import { DbWorldMonitorNormalizationRepository } from '@/features/worldmonitor/io/db_worldmonitor_normalization_repository';
import { NormalizeWorldMonitorDataUseCase } from '@/app/use_cases/normalize_worldmonitor_data_use_case';
import { attributeTopicForEvent, buildIntakeSessionFromCanonicalEvents } from '@/features/worldmonitor/domain/canonical_event_candidate_adapter';
import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import { eq } from 'drizzle-orm';

describe('Closed-Loop Ingestion to Review Pipeline', () => {
  it('correctly attributes canonical events to tracked topics', () => {
    expect(attributeTopicForEvent('Neuralink achieves breakthrough in brain-computer interface telemetry')).toBe('bci');
    expect(attributeTopicForEvent('工信部印发人形机器人创新发展指导意见')).toBe('humanoid_robotics');
    expect(attributeTopicForEvent('台积电2nm先进封装产线顺利通过客户验证')).toBe('provisional_advanced_packaging');
    expect(attributeTopicForEvent('我国商业航天可重复使用运载火箭完成垂直起降试验')).toBe('provisional_commercial_space');
    expect(attributeTopicForEvent('全固态锂电池能量密度突破500Wh/kg并完成装车实测')).toBe('provisional_solid_state_battery');
  });

  it('builds valid EvidenceIntakeSession with precise provenance citation offsets', () => {
    const canonical = {
      id: 9999,
      event_key: 'test_key_123',
      title: '低空经济eVTOL首条城际航线完成适航测试',
      normalized_title: '低空经济evtol首条城际航线完成适航测试',
      canonical_url: 'https://example.com/evtol-test',
      first_observed_at: '2026-08-21T00:00:00.000Z',
      last_observed_at: '2026-08-21T00:00:00.000Z',
      created_at: '2026-08-21T00:00:00.000Z',
      updated_at: '2026-08-21T00:00:00.000Z',
    };

    const session = buildIntakeSessionFromCanonicalEvents([
      {
        canonicalEvent: canonical,
        sourceName: 'DirectCaixinNews',
        sourceType: 'news',
        rawQuote: '低空经济eVTOL首条城际航线今日在珠海完成全部载人适航验证飞行。',
      },
    ]);

    expect(session.candidates.length).toBe(1);
    expect(session.candidates[0].suggested_evidence.topic_id).toBe('provisional_low_altitude_economy');
    expect(session.candidates[0].suggested_evidence.event_title).toBe(canonical.title);
    
    // Verify citation integrity
    const prov = session.provenance_records[0];
    const quoted = session.raw_document.text.slice(prov.quote_start_offset, prov.quote_end_offset);
    expect(quoted).toBe(prov.quote);
  });

  it('normalizes raw snapshot, produces canonical event, and creates intake session', async () => {
    const testHash = 'test_raw_snapshot_hash_' + Date.now();
    const [snapshot] = db.insert(rawSnapshots).values({
      source_id: 'DirectHackerNewsStories',
      external_id: 'https://news.ycombinator.com/item?id=99999',
      fetched_at: new Date().toISOString(),
      content_type: 'json',
      raw_body: JSON.stringify({
        hits: [{
          title: 'Quantum Computing team demonstrates 1000-qubit entanglement fidelity',
          objectID: '99999',
          url: 'https://news.ycombinator.com/item?id=99999',
          points: 250,
          num_comments: 50,
          created_at: '2026-08-21T00:00:00Z',
        }],
      }),
      content_hash: testHash,
      created_at: new Date().toISOString(),
    }).returning().all();

    let capturedSession: EvidenceIntakeSession | null = null;
    const normalizationRepo = new DbWorldMonitorNormalizationRepository();
    const useCase = new NormalizeWorldMonitorDataUseCase({
      normalizationRepo,
      writeIntakeSession: (session) => {
        capturedSession = session;
      },
    });

    const result = await useCase.execute(50);
    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(capturedSession).not.toBeNull();
    expect(capturedSession!.candidates.some(c => c.suggested_evidence.topic_id === 'provisional_quantum_computing')).toBe(true);

    // Verify rawSnapshot was updated with normalized_evidence_id
    const updated = db.select().from(rawSnapshots).where(eq(rawSnapshots.id, snapshot.id)).get();
    expect(updated?.normalized_evidence_id).toBeTruthy();
    expect(updated?.normalized_evidence_id).not.toBe('FAILED_PARSE');
  });
});
