import { resolve } from 'node:path';
import { writeGenericArtifact } from '@/platform/io/run_manifest_writer';
import type { StageSnapshotHistory } from '@/features/stages/types/diff';

export function writeStageHistory(repoRoot: string, snapshot: StageSnapshotHistory): void {
  writeGenericArtifact(`history/stage_snapshots/${snapshot.snapshot_id}.json`, snapshot);
  writeGenericArtifact(`runs/${snapshot.run_id}/stage_snapshot.json`, snapshot);
}
