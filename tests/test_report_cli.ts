import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { loadReportArtifacts, RUN_PIPELINE_FIRST } from '../src/services/report_artifact_loader';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8')) as T;
}

describe('report CLI', () => {
  it('generates weekly brief markdown and schema-valid JSON from isolated pipeline artifacts', () => {
    const isolatedRoot = mkdtempSync(join(tmpdir(), 'narrative-report-run-'));
    cpSync(resolve(repoRoot, 'data'), resolve(isolatedRoot, 'data'), { recursive: true });
    cpSync(resolve(repoRoot, 'schemas'), resolve(isolatedRoot, 'schemas'), { recursive: true });
    const env = { ...process.env, NARRATIVE_REPO_ROOT: isolatedRoot };
    execFileSync('npx', ['tsx', resolve(repoRoot, 'src/cli/run_weekly.ts')], { cwd: repoRoot, env, stdio: 'pipe' });
    execFileSync('npx', ['tsx', resolve(repoRoot, 'src/cli/run_report.ts')], { cwd: repoRoot, env, stdio: 'pipe' });

    const report = JSON.parse(readFileSync(resolve(isolatedRoot, 'outputs/reports/weekly_brief.json'), 'utf8')) as Record<string, unknown>;
    const markdown = readFileSync(resolve(isolatedRoot, 'outputs/reports/weekly_brief.md'), 'utf8');

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validateReport = ajv.compile(JSON.parse(readFileSync(resolve(isolatedRoot, 'schemas/weekly_brief.schema.json'), 'utf8')));

    expect(validateReport(report), JSON.stringify(validateReport.errors)).toBe(true);
    expect(markdown).toContain('## 1. Executive Summary');
    expect(markdown).toContain('## 9. Artifact Index');
    expect(JSON.stringify(report)).toContain('why_not_higher_stage');
    expect(JSON.stringify(report)).toContain('evidence_ids');
    expect(JSON.stringify(report)).not.toMatch(/\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i);
  });

  it('fails clearly when pipeline artifacts are missing', () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), 'narrative-report-empty-'));

    expect(() => loadReportArtifacts(emptyRoot)).toThrow(RUN_PIPELINE_FIRST);

    const result = spawnSync('npx', ['tsx', resolve(repoRoot, 'src/cli/run_report.ts')], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NARRATIVE_REPO_ROOT: emptyRoot,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(RUN_PIPELINE_FIRST);
  });
});
