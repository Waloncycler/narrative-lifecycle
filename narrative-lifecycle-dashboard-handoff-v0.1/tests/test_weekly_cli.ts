import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

describe('weekly CLI', () => {
  it('orchestrates one shared run context across pipeline, diff, report, and manifest', () => {
    execFileSync('npm', ['run', 'weekly'], { cwd: repoRoot, stdio: 'pipe' });
    const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'outputs/runs/latest_run.json'), 'utf8'));
    const report = JSON.parse(readFileSync(resolve(repoRoot, 'outputs/reports/weekly_brief.json'), 'utf8'));
    const diff = JSON.parse(readFileSync(resolve(repoRoot, 'outputs/diffs/latest_stage_diff.json'), 'utf8'));
    expect(manifest.status).toBe('ok');
    expect(diff.run_id).toBe(manifest.run_id);
    expect(report.report_id).toBe(`weekly_brief_${manifest.run_id}`);
    expect(report.stage_change_summary.current_snapshot_id).toBe(diff.current_snapshot_id);
    expect(existsSync(resolve(repoRoot, `outputs/runs/${manifest.run_id}/stage_snapshot.json`))).toBe(true);
    expect(existsSync(resolve(repoRoot, `outputs/runs/${manifest.run_id}/weekly_brief.json`))).toBe(true);
  });
});
