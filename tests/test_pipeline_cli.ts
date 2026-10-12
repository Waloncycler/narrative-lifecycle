import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { FileSchemaValidator } from '@/platform/io/app_di_container';
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8')) as T;
}

describe('pipeline CLI', () => {
  it('generates schema-valid artifacts from the executable pipeline', () => {
    execFileSync('npm', ['run', 'pipeline'], { cwd: repoRoot, stdio: 'pipe' });

    const summary = readGenericArtifact<{
      golden_results: Array<{ topic_id: string; passed: boolean; failures: string[] }>;
      dashboard_card_files: string[];
      score_files: string[];
      early_radar_count: number;
    }>('pipeline_summary.json')!;

    expect(summary.golden_results).toHaveLength(3);
    expect(summary.golden_results.every((result) => result.passed)).toBe(true);
    expect(summary.golden_results.flatMap((result) => result.failures)).toEqual([]);
    expect(summary.dashboard_card_files).toHaveLength(3);
    expect(summary.score_files).toHaveLength(3);
    expect(summary.early_radar_count).toBe(1);

    const validator = new FileSchemaValidator();
    const validateCard = (data: unknown) => validator.validate('dashboard_card.schema.json', data);
    const validateScore = (data: unknown) => validator.validate('score.schema.json', data);
    const validateRadar = (data: unknown) => validator.validate('early_radar_candidate.schema.json', data);

    for (const file of summary.dashboard_card_files) {
      const card = readGenericArtifact<Record<string, unknown>>(file.replace(/^outputs\//, ''))!;
      expect(card).toBeTruthy();
      expect(() => validateCard(card)).not.toThrow();
      expect(JSON.stringify(card)).not.toMatch(/\b(buy|sell|target price|entry|exit|position sizing)\b/i);
    }

    for (const file of summary.score_files) {
      const score = readGenericArtifact<Record<string, unknown>>(file.replace(/^outputs\//, ''))!;
      expect(score).toBeTruthy();
      expect(() => validateScore(score)).not.toThrow();
    }

    const radar = readGenericArtifact<Record<string, unknown>[]>('early_radar_candidates.json')!;
    expect(radar).toHaveLength(1);
    expect(() => validateRadar(radar[0])).not.toThrow();
    expect(radar[0].reactivation_record_id).toEqual(expect.any(String));
  });
});
