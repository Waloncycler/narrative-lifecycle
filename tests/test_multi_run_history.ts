import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPreviousSnapshot } from '@/features/stages/pipeline/diff_artifact_loader';
import { writeStageHistory } from '@/features/stages/pipeline/stage_history_writer';
import { writeGenericArtifact } from '@/platform/io/run_manifest_writer';
import type { StageSnapshotHistory } from '@/features/stages/types/diff';

describe('multi-run history', () => {
  it('preserves same-day snapshots and never selects the current run as previous', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'narrative-multi-run-'));
    const guardrail_check = {
      no_trading_advice: true,
      research_only_actions: true,
      parent_branch_separation_preserved: true,
      evidence_ids_visible: true,
      why_not_higher_present: true,
      data_confidence_present: true,
    };
    const common: Omit<StageSnapshotHistory, 'snapshot_id' | 'run_id' | 'generated_at'> = {
      artifact_type: 'stage_snapshot_history', schema_version: '1.0.0', producer_version: '0.4.0',
      rule_version: 'test', source_report_id: 'weekly_test', topics: [], early_radar_candidates: [], guardrail_check,
    };
    const first: StageSnapshotHistory = { ...common, snapshot_id: 'stage_snapshot_run_20260711T100000000_abc123', run_id: 'run_20260711T100000000_abc123', generated_at: '2026-07-11T10:00:00.000Z' };
    const second: StageSnapshotHistory = { ...common, snapshot_id: 'stage_snapshot_run_20260711T100001000_def456', run_id: 'run_20260711T100001000_def456', generated_at: '2026-07-11T10:00:01.000Z' };
    writeStageHistory(root, first);
    writeStageHistory(root, second);
    writeGenericArtifact('history/stage_snapshots/stage_snapshot_run_20260711T100000500_bad999.json', {
      snapshot_id: 'stage_snapshot_run_20260711T100000500_bad999',
      run_id: 'run_20260711T100000500_bad999',
      generated_at: '2026-07-11T10:00:00.500Z',
      topics: [],
      early_radar_candidates: [],
    });
    const previous = loadPreviousSnapshot(root, { run_id: second.run_id, started_at: second.generated_at });
    expect(previous?.snapshot_id).toBe(first.snapshot_id);
  });
});
