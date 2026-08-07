import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8')) as T;
}

describe('pipeline CLI', () => {
  it('generates schema-valid artifacts from the executable pipeline', () => {
    execFileSync('npm', ['run', 'pipeline'], { cwd: repoRoot, stdio: 'pipe' });

    const summary = readJson<{
      golden_results: Array<{ topic_id: string; passed: boolean; failures: string[] }>;
      dashboard_card_files: string[];
      score_files: string[];
      early_radar_count: number;
    }>('outputs/pipeline_summary.json');

    expect(summary.golden_results).toHaveLength(3);
    expect(summary.golden_results.every((result) => result.passed)).toBe(true);
    expect(summary.golden_results.flatMap((result) => result.failures)).toEqual([]);
    expect(summary.dashboard_card_files).toHaveLength(3);
    expect(summary.score_files).toHaveLength(3);
    expect(summary.early_radar_count).toBe(1);

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validateCard = ajv.compile(readJson('schemas/dashboard_card.schema.json'));
    const validateScore = ajv.compile(readJson('schemas/score.schema.json'));
    const validateRadar = ajv.compile(readJson('schemas/early_radar_candidate.schema.json'));

    for (const file of summary.dashboard_card_files) {
      expect(existsSync(resolve(repoRoot, file))).toBe(true);
      const card = readJson<Record<string, unknown>>(file);
      expect(validateCard(card), JSON.stringify(validateCard.errors)).toBe(true);
      expect(JSON.stringify(card)).not.toMatch(/\b(buy|sell|target price|entry|exit|position sizing)\b/i);
    }

    for (const file of summary.score_files) {
      expect(existsSync(resolve(repoRoot, file))).toBe(true);
      const score = readJson<Record<string, unknown>>(file);
      expect(validateScore(score), JSON.stringify(validateScore.errors)).toBe(true);
    }

    const radar = readJson<Record<string, unknown>[]>('outputs/early_radar_candidates.json');
    expect(radar).toHaveLength(1);
    expect(validateRadar(radar[0]), JSON.stringify(validateRadar.errors)).toBe(true);
    expect(radar[0].reactivation_record_id).toEqual(expect.any(String));
  });
});
