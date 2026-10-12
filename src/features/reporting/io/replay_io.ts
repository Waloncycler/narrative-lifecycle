import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { ReplayCase, ReplayLedger } from '@/features/reporting/types/replay';
import type { RunManifest } from '@/platform/types/run_context';
import { DbArtifactRepository } from '@/platform/io/db_artifact_repository';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { db } from '@/db/index';
import { evidence } from '@/db/schema';
import { and, lte, eq } from 'drizzle-orm';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';

export const REPLAY_CASES_PATH = 'data/replay/replay_cases.yaml';

export class DbReplayRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  readReplayCases(): ReplayCase[] {
    return readGenericArtifact(resolve(this.repoRoot, REPLAY_CASES_PATH))! as ReplayCase[];
  }

  readLatestRun(): RunManifest | null {
    const target = 'runs/latest_run.json';
    if (!existsSync(target)) return null;
    return readGenericArtifact(target)! as RunManifest;
  }

  writeReplayLedger(ledger: ReplayLedger, markdown: string): void {
    const dbArtifact = new DbArtifactRepository();
    dbArtifact.writeArtifact('replay_ledger_latest', 'replay_ledger', ledger, markdown);
    dbArtifact.writeArtifact(`replay_ledger_${ledger.ledger_id}`, 'replay_ledger', ledger);
  }

  sourceArtifacts(): string[] {
    return [REPLAY_CASES_PATH, 'outputs/runs/latest_run.json'];
  }

  readEvidenceForTopicAsOf(topicId: string, asOf: string): EvidenceNode[] {
    const rows = db.select()
      .from(evidence)
      .where(and(eq(evidence.topic_id, topicId), lte(evidence.available_at, asOf)))
      .all();
    
    return rows.map((row: any) => ({
      evidence_id: row.evidence_id,
      topic_id: row.topic_id,
      branch_id: row.branch_id || undefined,
      event_date: row.event_date,
      available_at: row.available_at,
      event_title: row.event_title,
      event_summary: row.event_summary,
      event_type: row.event_type,
      source_name: row.source_name,
      source_url: row.source_url || undefined,
      source_type: row.source_type as any,
      evidence_strength: row.evidence_strength as any,
      affected_layer: JSON.parse(row.affected_layer_json),
      stage_effect: row.stage_effect as any,
      parent_or_branch: row.parent_or_branch as any,
      branch_coverage_score: row.branch_coverage_score,
      interpretation: row.interpretation,
      limitation: row.limitation,
      positive_or_negative: row.positive_or_negative as any,
      confidence: row.confidence,
    }));
  }
}
