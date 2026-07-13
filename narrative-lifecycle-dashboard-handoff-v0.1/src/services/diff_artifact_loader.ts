import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ScoreResult } from '../domain/scoring';
import type { StageSnapshotHistory } from '../types/diff';
import type { RunContext } from '../types/run_context';
import type { DashboardCard } from './dashboard_card_service';
import type { EarlyRadarCandidate } from './early_radar_service';

export const RUN_PIPELINE_FIRST_FOR_DIFF = 'Please run npm run pipeline first.';

export interface DiffArtifacts {
  dashboard_cards: DashboardCard[];
  scores: ScoreResult[];
  early_radar_candidates: EarlyRadarCandidate[];
  system_summary: { run_id: string; generated_at: string; rule_version: string };
}

function readJson<T>(path: string, missingMessage = RUN_PIPELINE_FIRST_FOR_DIFF): T {
  if (!existsSync(path)) throw new Error(missingMessage);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readJsonDirectory<T>(repoRoot: string, relativeDirectory: string): T[] {
  const directory = resolve(repoRoot, relativeDirectory);
  if (!existsSync(directory)) throw new Error(RUN_PIPELINE_FIRST_FOR_DIFF);
  const files = readdirSync(directory).filter((file) => file.endsWith('.json')).sort();
  if (!files.length) throw new Error(RUN_PIPELINE_FIRST_FOR_DIFF);
  return files.map((file) => readJson<T>(resolve(directory, file)));
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
  const directory = resolve(repoRoot, 'outputs/history/stage_snapshots');
  if (!existsSync(directory)) return null;
  const snapshots = readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .map((file) => readJson<StageSnapshotHistory>(resolve(directory, file)))
    .filter((snapshot) => typeof snapshot.run_id === 'string' && snapshot.run_id.length > 0)
    .filter((snapshot) => !current || (snapshot.run_id !== current.run_id && snapshot.generated_at < current.started_at))
    .sort((a, b) => a.generated_at.localeCompare(b.generated_at));
  return snapshots.at(-1) ?? null;
}
