import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeRunManifest } from '../src/services/run_manifest_writer';
import type { RunManifest } from '../src/types/run_context';
import { artifactMetadata } from '../src/types/artifact_contract';

describe('run manifest writer', () => {
  it('writes immutable run manifests and only advances latest for successful runs', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'narrative-manifest-'));
    const base: Omit<RunManifest, 'status'> = { ...artifactMetadata({ artifact_type: 'run_manifest', rule_version: 'rules', run_id: 'run_20260711T193045123_abc123', generated_at: '2026-07-11T19:30:45.123Z' }), run_id: 'run_20260711T193045123_abc123', started_at: '2026-07-11T19:30:45.123Z', completed_at: '2026-07-11T19:31:00.000Z', commands: ['pipeline', 'diff', 'report'], artifacts: [], previous_run_id: null, current_snapshot_id: 'stage_snapshot_run_20260711T193045123_abc123', previous_snapshot_id: null, rule_version: 'rules', artifact_version: '0.4.0', guardrail_status: 'ok' };
    writeRunManifest(root, { ...base, status: 'ok' });
    writeRunManifest(root, { ...base, run_id: 'run_20260711T193046123_def456', status: 'failed' });
    const latest = JSON.parse(readFileSync(resolve(root, 'outputs/runs/latest_run.json'), 'utf8'));
    expect(latest.run_id).toBe(base.run_id);
    expect(existsSync(resolve(root, 'outputs/runs/run_20260711T193046123_def456/run_manifest.json'))).toBe(true);
  });
});
