import { resolve } from 'node:path';
import { writeJsonAtomically } from './run_manifest_writer';
import type { StageSnapshotHistory } from '../types/diff';

export function writeStageHistory(repoRoot: string, snapshot: StageSnapshotHistory): void {
  const snapshotsDir = resolve(repoRoot, 'outputs/history/stage_snapshots');
  writeJsonAtomically(resolve(snapshotsDir, `${snapshot.snapshot_id}.json`), snapshot);
  writeJsonAtomically(resolve(repoRoot, 'outputs/runs', snapshot.run_id, 'stage_snapshot.json'), snapshot);
}
