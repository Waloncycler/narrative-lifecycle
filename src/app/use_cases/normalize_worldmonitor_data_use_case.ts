import type { DbWorldMonitorNormalizationRepository } from '@/features/worldmonitor/io/db_worldmonitor_normalization_repository';
import { normalizerIdForOperation, normalizedFactsFromWorldMonitorPayload } from '@/features/worldmonitor/domain/worldmonitor_normalizers';
import type { WorldMonitorPayload } from '@/features/worldmonitor/types/worldmonitor_adapter';
import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import { buildIntakeSessionFromCanonicalEvents, type CanonicalEventCandidateInput } from '@/features/worldmonitor/domain/canonical_event_candidate_adapter';

export interface NormalizeWorldMonitorDataUseCaseDeps {
  normalizationRepo: DbWorldMonitorNormalizationRepository;
  writeIntakeSession?: (session: EvidenceIntakeSession) => void;
  now?: () => string;
}

export class NormalizeWorldMonitorDataUseCase {
  constructor(private deps: NormalizeWorldMonitorDataUseCaseDeps) {}

  async execute(limit: number = 100): Promise<{
    processed: number;
    failed: number;
    session: EvidenceIntakeSession | null;
  }> {
    const snapshots = await this.deps.normalizationRepo.fetchUnprocessedSnapshots(limit);
    let processed = 0;
    let failed = 0;
    const candidateInputs: CanonicalEventCandidateInput[] = [];

    for (const snapshot of snapshots) {
      try {
        let body: unknown = snapshot.raw_body;
        if (snapshot.content_type === 'json' && typeof snapshot.raw_body === 'string') {
          try {
            body = JSON.parse(snapshot.raw_body);
          } catch {
            // keep as string
          }
        } else if (snapshot.content_type === 'xml') {
          body = { __xml: snapshot.raw_body };
        } else if (snapshot.content_type === 'html') {
          body = { __html: snapshot.raw_body };
        } else if (snapshot.content_type === 'text') {
          body = { __raw_text: snapshot.raw_body };
        }

        const payload: WorldMonitorPayload = {
          body,
          descriptor: {
            source_id: snapshot.source_id,
            operation_id: snapshot.source_id,
            priority: 'P1',
            type: 'poll',
            normalizer_id: normalizerIdForOperation(snapshot.source_id),
          } as any,
          fetched_at: snapshot.fetched_at,
          source_url: snapshot.external_id,
          mode: 'live',
          payload_hash: '',
          degraded: false,
          stale: false,
        };

        const facts = normalizedFactsFromWorldMonitorPayload(payload);
        
        if (facts.length === 0) {
          await this.deps.normalizationRepo.markSnapshotFailed(snapshot.id);
          failed++;
          continue;
        }

        let savedAny = false;
        for (const fact of facts) {
          const canonical = await this.deps.normalizationRepo.saveNormalizedFact(snapshot.id, fact);
          if (canonical) {
            candidateInputs.push({
              canonicalEvent: canonical,
              sourceName: snapshot.source_id,
              sourceType: 'news',
              rawQuote: fact.summary || fact.title,
            });
          }
          savedAny = true;
          break;
        }

        if (savedAny) {
          processed++;
        } else {
          await this.deps.normalizationRepo.markSnapshotFailed(snapshot.id);
          failed++;
        }

      } catch (err) {
        console.error(`Failed to normalize snapshot ${snapshot.id}:`, err);
        await this.deps.normalizationRepo.markSnapshotFailed(snapshot.id);
        failed++;
      }
    }

    let session: EvidenceIntakeSession | null = null;
    if (candidateInputs.length > 0) {
      const nowStr = this.deps.now ? this.deps.now() : new Date().toISOString();
      session = buildIntakeSessionFromCanonicalEvents(candidateInputs, nowStr);
      if (this.deps.writeIntakeSession) {
        this.deps.writeIntakeSession(session);
      }
    }

    return { processed, failed, session };
  }
}
