import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StageSnapshotHistory } from '../src/types/diff';
import { writeStageHistory } from '../src/services/stage_history_writer';

describe('stage history writer', () => {
  it('writes immutable snapshot copies to history and per-run storage', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'narrative-history-'));
    const snapshot = { snapshot_id: 'stage_snapshot_run_20260705T000000000_abcdef', run_id: 'run_20260705T000000000_abcdef' } as StageSnapshotHistory;
    writeStageHistory(root, snapshot);
    const snapshotPath = resolve(root, 'outputs/history/stage_snapshots/stage_snapshot_run_20260705T000000000_abcdef.json');
    const runPath = resolve(root, 'outputs/runs/run_20260705T000000000_abcdef/stage_snapshot.json');
    expect(existsSync(snapshotPath)).toBe(true);
    expect(existsSync(runPath)).toBe(true);
    expect(JSON.parse(readFileSync(snapshotPath, 'utf8')).snapshot_id).toBe(snapshot.snapshot_id);
  });
});
