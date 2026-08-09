import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function readJson<T>(root: string, path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T;
}

function seedWorkspace(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'narrative-artifact-snapshot-'));
  for (const directory of ['data', 'schemas', 'configs']) {
    cpSync(resolve(repoRoot, directory), resolve(root, directory), { recursive: true });
  }
  mkdirSync(resolve(root, 'outputs'), { recursive: true });
  return root;
}

describe('artifact semantic snapshot', () => {
  it('preserves golden-case stages and v0.4 artifact metadata', () => {
    // Run in an isolated workspace so this semantic snapshot never races
    // another CLI test that is producing its own generated outputs.
    const root = seedWorkspace();
    const weekly = spawnSync('npx', ['tsx', resolve(repoRoot, 'src/cli/run_weekly.ts')], {
      cwd: repoRoot,
      env: { ...process.env, NARRATIVE_REPO_ROOT: root },
      encoding: 'utf8',
    });
    expect(weekly.status, weekly.stderr).toBe(0);
    const latestRun = readJson<{ run_id: string; artifact_type: string; schema_version: string; producer_version: string }>(root, 'outputs/runs/latest_run.json');
    const diff = readJson<{ artifact_type: string; producer_version: string; run_id: string; topic_changes: Array<{ topic_id: string; current_stage: string }> }>(root, 'outputs/diffs/latest_stage_diff.json');
    const report = readJson<{ artifact_type: string; producer_version: string; run_id: string; stage_snapshot: Array<{ topic_id: string; current_stage: string }> }>(root, 'outputs/reports/weekly_brief.json');

    expect(latestRun).toMatchObject({ artifact_type: 'run_manifest', schema_version: '1.0.0', producer_version: '0.4.0' });
    expect(diff).toMatchObject({ artifact_type: 'stage_diff', producer_version: '0.4.0', run_id: latestRun.run_id });
    expect(report).toMatchObject({ artifact_type: 'weekly_brief', producer_version: '0.4.0', run_id: latestRun.run_id });
    expect(Object.fromEntries(report.stage_snapshot.map((item) => [item.topic_id, item.current_stage]))).toMatchObject({
      bci: 'S4',
      humanoid_robotics: 'S5-S6',
      innovative_drug_license_out: 'S5-S6',
    });
  });
});
