import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { db } from '@/db/index';
import { genericArtifacts, stageSnapshots } from '@/db/schema';
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

function isUsableStageSnapshot(value: unknown): value is StageSnapshotHistory {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<StageSnapshotHistory>;
  const guardrails = snapshot.guardrail_check;
  return typeof snapshot.snapshot_id === 'string'
    && typeof snapshot.run_id === 'string'
    && snapshot.run_id.length > 0
    && typeof snapshot.generated_at === 'string'
    && !Number.isNaN(Date.parse(snapshot.generated_at))
    && Array.isArray(snapshot.topics)
    && Array.isArray(snapshot.early_radar_candidates)
    && Boolean(guardrails)
    && typeof guardrails?.no_trading_advice === 'boolean'
    && typeof guardrails?.research_only_actions === 'boolean'
    && typeof guardrails?.parent_branch_separation_preserved === 'boolean'
    && typeof guardrails?.evidence_ids_visible === 'boolean'
    && typeof guardrails?.why_not_higher_present === 'boolean'
    && typeof guardrails?.data_confidence_present === 'boolean';
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
  const legacyRecords = db.select().from(genericArtifacts).where(like(genericArtifacts.artifact_id, `history/stage_snapshots/%`)).all();
  const databaseRecords = db.select().from(stageSnapshots).all();
  const serializedSnapshots = [
    ...legacyRecords.map((record) => record.content_json),
    ...databaseRecords.map((record) => record.snapshot_json),
  ];
  if (!serializedSnapshots.length) return null;
  const snapshots = serializedSnapshots
    .flatMap((serialized) => {
      try { return [JSON.parse(serialized) as unknown]; } catch { return []; }
    })
    // Legacy history ids may contain adjacent report artifacts. A previous
    // snapshot is usable only when it has the public snapshot shape.
    .filter(isUsableStageSnapshot)
    .filter((snapshot) => !current || (snapshot.run_id !== current.run_id && snapshot.generated_at < current.started_at))
    .sort((a, b) => a.generated_at.localeCompare(b.generated_at));
  return snapshots.at(-1) ?? null;
}
