import { readGenericArtifact } from '@/platform/io/run_manifest_writer';
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

describe('artifact semantic snapshot', () => {
  it('preserves golden-case stages and v0.4 artifact metadata', () => {
    execFileSync('npm', ['run', 'pipeline'], { cwd: repoRoot, stdio: 'pipe' });
    const summary = readGenericArtifact<{ dashboard_card_files: string[] }>('pipeline_summary.json')!;
    const cards = summary.dashboard_card_files.map((path) => readGenericArtifact<{ card_id: string; topic_id: string; current_stage: string; why_not_higher_stage: string }>(path.replace(/^outputs\//, ''))!);
    expect(cards.every((card) => card.card_id.startsWith('card_') && card.why_not_higher_stage.length > 0)).toBe(true);
    expect(Object.fromEntries(cards.map((item) => [item.topic_id, item.current_stage]))).toMatchObject({
      bci: 'S4',
      humanoid_robotics: 'S5-S6',
      innovative_drug_license_out: 'S5-S6',
    });
  });
});
