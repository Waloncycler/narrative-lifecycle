import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { ReplayLedger } from '../src/types/replay';

const repoRoot = resolve(import.meta.dirname, '..');

function writeJson(root: string, path: string, value: unknown): void {
  const target = resolve(root, path);
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function seedReplayWorkspace(root: string): void {
  cpSync(resolve(repoRoot, 'schemas'), resolve(root, 'schemas'), { recursive: true });
  cpSync(resolve(repoRoot, 'data/replay'), resolve(root, 'data/replay'), { recursive: true });
  writeJson(root, 'outputs/runs/latest_run.json', {
    artifact_type: 'run_manifest',
    schema_version: '1.0.0',
    producer_version: '0.4.0',
    rule_version: 'rules',
    run_id: 'run_20260720T000000000_abc123',
    generated_at: '2026-07-20T00:00:00.000Z',
    started_at: '2026-07-20T00:00:00.000Z',
    completed_at: '2026-07-20T00:00:00.000Z',
    status: 'ok',
    commands: ['pipeline', 'diff', 'report'],
    artifacts: [],
    previous_run_id: null,
    current_snapshot_id: 'stage_snapshot_run_20260720T000000000_abc123',
    previous_snapshot_id: null,
    artifact_version: '0.4.0',
    guardrail_status: 'ok',
  });
}

describe('replay CLI', () => {
  it('builds a schema-valid historical replay ledger without future evidence leakage', () => {
    const root = join(tmpdir(), `replay-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    seedReplayWorkspace(root);

    execFileSync('npm', ['run', 'replay'], { cwd: repoRoot, env: { ...process.env, NARRATIVE_REPO_ROOT: root }, stdio: 'pipe' });

    const ledger = JSON.parse(readFileSync(resolve(root, 'outputs/replay/latest_replay_ledger.json'), 'utf8')) as ReplayLedger;
    const markdown = readFileSync(resolve(root, 'outputs/replay/latest_replay_ledger.md'), 'utf8');
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(readFileSync(resolve(root, 'schemas/replay_ledger.schema.json'), 'utf8')));

    expect(validate(ledger), JSON.stringify(validate.errors)).toBe(true);
    expect(ledger.case_count).toBe(5);
    expect(new Set(ledger.replay_cases.map((item) => item.scenario_type))).toEqual(new Set(['success', 'failure', 's7b', 's7c', 'long_no_change']));
    expect(ledger.guardrail_check).toMatchObject({
      no_future_evidence_used: true,
      no_trading_advice: true,
      no_price_based_outcome_inference: true,
      parent_branch_separation_preserved: true,
    });

    const bci = ledger.replay_cases.find((item) => item.case_id === 'replay_bci_s7c_branch');
    expect(bci?.final_stage_before_outcome).toBe('S4');
    expect(bci?.stage_path.at(-1)?.branch_stages).toEqual([
      expect.objectContaining({ branch_id: 'bci_medical_rehab', current_stage: 'S7C' }),
    ]);
    expect(ledger.replay_cases.find((item) => item.case_id === 'replay_metaverse_failure')).toMatchObject({
      outcome_status: 'falsified',
      false_positive: true,
    });
    expect(markdown).toContain('Historical Narrative Replay');
    expect(JSON.stringify(ledger)).not.toMatch(/\b(buy|sell|entry|exit|position|target price|stop loss)\b|\b(go|going|went)\s+(long|short)\b|\b(long|short)\s+(trade|position|call|idea)\b/i);
  });
});
