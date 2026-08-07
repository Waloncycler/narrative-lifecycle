import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPreviousSnapshot } from '../src/services/diff_artifact_loader';
import { writeStageHistory } from '../src/services/stage_history_writer';
import type { StageSnapshotHistory } from '../src/types/diff';

describe('multi-run history', () => {
  it('preserves same-day snapshots and never selects the current run as previous', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'narrative-multi-run-'));
    const first = { snapshot_id: 'stage_snapshot_run_20260711T100000000_abc123', run_id: 'run_20260711T100000000_abc123', generated_at: '2026-07-11T10:00:00.000Z' } as StageSnapshotHistory;
    const second = { snapshot_id: 'stage_snapshot_run_20260711T100001000_def456', run_id: 'run_20260711T100001000_def456', generated_at: '2026-07-11T10:00:01.000Z' } as StageSnapshotHistory;
    writeStageHistory(root, first);
    writeStageHistory(root, second);
    const previous = loadPreviousSnapshot(root, { run_id: second.run_id, started_at: second.generated_at });
    expect(previous?.snapshot_id).toBe(first.snapshot_id);
  });
});
