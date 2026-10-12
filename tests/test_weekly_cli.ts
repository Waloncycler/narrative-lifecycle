import { readGenericArtifact } from '@/platform/io/run_manifest_writer';
import { db } from '@/db/index';
import { systemRuns, stageDiffs } from '@/db/schema';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

describe('weekly CLI', () => {
  it('orchestrates one shared run context across pipeline, diff, report, and manifest', () => {
    execFileSync('npm', ['run', 'weekly'], { cwd: repoRoot, stdio: 'pipe' });
    const manifest = db.select().from(systemRuns).orderBy(systemRuns.started_at).all().at(-1) as any;
    const report = readGenericArtifact('reports/weekly_brief.json') as any;
    const diffRecord = db.select().from(stageDiffs).orderBy(stageDiffs.generated_at).all().at(-1);
    const diff = diffRecord ? JSON.parse(diffRecord.diff_json) : null;
    expect(manifest.status).toBe('ok');
    expect(diff.run_id).toBe(manifest.run_id);
    expect(report.report_id).toBe(`weekly_brief_${manifest.run_id}`);
    expect(report.stage_change_summary.current_snapshot_id).toBe(diff.current_snapshot_id);
    expect(readGenericArtifact(`runs/${manifest.run_id}/stage_snapshot.json`)).not.toBeNull();
    expect(readGenericArtifact(`runs/${manifest.run_id}/weekly_brief.json`)).not.toBeNull();
  });
});
