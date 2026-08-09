import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function seedWorkspace(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'narrative-autonomy-cli-'));
  for (const directory of ['configs', 'data', 'schemas']) {
    cpSync(resolve(repoRoot, directory), resolve(root, directory), { recursive: true });
  }
  mkdirSync(resolve(root, 'outputs'), { recursive: true });
  return root;
}

function run(root: string, args: string[] = []) {
  return spawnSync('npx', ['tsx', resolve(repoRoot, 'src/cli/run_autonomous_research.ts'), ...args], {
    cwd: repoRoot,
    env: { ...process.env, NARRATIVE_REPO_ROOT: root },
    encoding: 'utf8',
  });
}

describe('autonomy CLI publication contract', () => {
  it('is review-only by default and stays review-only while policy publication is disabled', () => {
    const root = seedWorkspace();
    const defaultRun = run(root);
    expect(defaultRun.status, defaultRun.stderr).toBe(0);
    expect(defaultRun.stdout).toContain('mode=review_required');
    expect(defaultRun.stdout).toContain('requested=false');

    const requestedRun = run(root, ['--publish-auto']);
    expect(requestedRun.status, requestedRun.stderr).toBe(0);
    expect(requestedRun.stdout).toContain('mode=review_required');
    expect(requestedRun.stdout).toContain('requested=true');

    const report = JSON.parse(readFileSync(resolve(root, 'outputs/autonomy/latest_promotion_report.json'), 'utf8')) as {
      publication_mode: string;
      publication_requested: boolean;
      published_count: number;
      guardrail_check: { automatic_publication_enabled: boolean };
    };
    expect(report).toMatchObject({ publication_mode: 'review_required', publication_requested: true, published_count: 0 });
    expect(report.guardrail_check.automatic_publication_enabled).toBe(false);
  });
});
