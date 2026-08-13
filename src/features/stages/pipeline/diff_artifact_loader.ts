import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { db } from '@/db/index';
import { genericArtifacts } from '@/db/schema';
import { like } from 'drizzle-orm';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ScoreResult } from '@/features/scoring/domain/scoring';
import type { StageSnapshotHistory } from '@/features/stages/types/diff';
import type { RunContext } from '@/platform/types/run_context';
import type { DashboardCard } from '@/features/reporting/domain/dashboard_card_service';
import type { EarlyRadarCandidate } from '@/features/reporting/domain/early_radar_service';

export const RUN_PIPELINE_FIRST_FOR_DIFF = 'Please run npm run pipeline first.';

export interface DiffArtifacts {
  dashboard_cards: DashboardCard[];
  scores: ScoreResult[];
  early_radar_candidates: EarlyRadarCandidate[];
  system_summary: { run_id: string; generated_at: string; rule_version: string };
}

function readJson<T>(path: string, missingMessage = RUN_PIPELINE_FIRST_FOR_DIFF): T {
  const id = path.includes('outputs/') ? path.substring(path.indexOf('outputs/') + 8) : path;
  const data = readGenericArtifact(id);
  if (!data) throw new Error(missingMessage);
  return data as T;
}

function readJsonDirectory<T>(repoRoot: string, relativeDirectory: string): T[] {
  const prefix = relativeDirectory.replace(/^outputs\//, '') + '/';
  const records = db.select().from(genericArtifacts).where(like(genericArtifacts.artifact_id, `${prefix}%`)).all();
  if (records.length > 0) {
    return records.map(r => JSON.parse(r.content_json) as T);
  }
  throw new Error(RUN_PIPELINE_FIRST_FOR_DIFF);
}

export function loadDiffArtifacts(repoRoot: string): DiffArtifacts {
  return {
    dashboard_cards: readJsonDirectory(repoRoot, 'outputs/dashboard_cards'),
    scores: readJsonDirectory(repoRoot, 'outputs/scores'),
    early_radar_candidates: readJson(resolve(repoRoot, 'outputs/early_radar_candidates.json')),
    system_summary: readJson(resolve(repoRoot, 'outputs/system_summary.json')),
  };
}

export function loadPreviousSnapshot(repoRoot: string, current?: Pick<RunContext, 'run_id' | 'started_at'>): StageSnapshotHistory | null {
  const records = db.select().from(genericArtifacts).where(like(genericArtifacts.artifact_id, `history/stage_snapshots/%`)).all();
  if (!records.length) return null;
  const snapshots = records
    .map(r => JSON.parse(r.content_json) as StageSnapshotHistory)
    .filter((snapshot) => typeof snapshot.run_id === 'string' && snapshot.run_id.length > 0)
    .filter((snapshot) => !current || (snapshot.run_id !== current.run_id && snapshot.generated_at < current.started_at))
    .sort((a, b) => a.generated_at.localeCompare(b.generated_at));
  return snapshots.at(-1) ?? null;
}
