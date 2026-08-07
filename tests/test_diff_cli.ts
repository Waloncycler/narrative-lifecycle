import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { RUN_PIPELINE_FIRST_FOR_DIFF } from '../src/services/diff_artifact_loader';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function run(root: string, runId: string, startedAt: string) {
  return spawnSync('npx', ['tsx', resolve(repoRoot, 'src/cli/run_diff.ts')], {
    cwd: repoRoot, env: { ...process.env, NARRATIVE_REPO_ROOT: root, NARRATIVE_RUN_ID: runId, NARRATIVE_RUN_STARTED_AT: startedAt }, encoding: 'utf8',
  });
}

describe('diff CLI', () => {
  it('writes a schema-valid baseline, history, and then no-change comparison', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'narrative-diff-'));
    mkdirSync(resolve(root, 'outputs'), { recursive: true });
    cpSync(resolve(repoRoot, 'outputs/dashboard_cards'), resolve(root, 'outputs/dashboard_cards'), { recursive: true });
    cpSync(resolve(repoRoot, 'outputs/scores'), resolve(root, 'outputs/scores'), { recursive: true });
    cpSync(resolve(repoRoot, 'outputs/early_radar_candidates.json'), resolve(root, 'outputs/early_radar_candidates.json'));
    cpSync(resolve(repoRoot, 'outputs/system_summary.json'), resolve(root, 'outputs/system_summary.json'));
    cpSync(resolve(repoRoot, 'schemas'), resolve(root, 'schemas'), { recursive: true });

    const first = run(root, 'run_20260705T000000000_abcdef', '2026-07-05T00:00:00.000Z');
    expect(first.status, first.stderr).toBe(0);
    let diff = JSON.parse(readFileSync(resolve(root, 'outputs/diffs/latest_stage_diff.json'), 'utf8'));
    expect(diff.status).toBe('no_previous_snapshot');
    expect(existsSync(resolve(root, `outputs/history/stage_snapshots/${diff.current_snapshot_id}.json`))).toBe(true);

    const second = run(root, 'run_20260706T000000000_abcdef', '2026-07-06T00:00:00.000Z');
    expect(second.status, second.stderr).toBe(0);
    diff = JSON.parse(readFileSync(resolve(root, 'outputs/diffs/latest_stage_diff.json'), 'utf8'));
    expect(diff.status).toBe('ok');
    expect(diff.topic_changes.every((change: { change_type: string }) => change.change_type === 'no_change')).toBe(true);

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const schema = JSON.parse(readFileSync(resolve(root, 'schemas/stage_diff.schema.json'), 'utf8'));
    const validate = ajv.compile(schema);
    expect(validate(diff), JSON.stringify(validate.errors)).toBe(true);
    expect(JSON.stringify(diff)).not.toMatch(/\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i);
  });

  it('fails clearly before a report exists', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'narrative-diff-empty-'));
    const result = run(root, 'run_20260705T000000000_abcdef', '2026-07-05T00:00:00.000Z');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(RUN_PIPELINE_FIRST_FOR_DIFF);
  });
});
