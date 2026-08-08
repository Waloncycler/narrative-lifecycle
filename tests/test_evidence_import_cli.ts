import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';

const repoRoot = resolve(import.meta.dirname, '..');

function seedWorkspace(): string {
  const root = join(tmpdir(), `evidence-import-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  for (const directory of ['schemas', 'configs', 'data']) {
    cpSync(resolve(repoRoot, directory), resolve(root, directory), { recursive: true });
  }
  writeFileSync(resolve(root, 'data/sample_evidence/manual_imported_evidence.yaml'), '[]\n');
  return root;
}

function environment(root: string): NodeJS.ProcessEnv {
  return { ...process.env, NARRATIVE_REPO_ROOT: root };
}

function readJson<T>(root: string, path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T;
}

describe('evidence import CLI', () => {
  it('validates, imports, and idempotently reimports accepted evidence with an audit log', () => {
    const root = seedWorkspace();
    const env = environment(root);
    execFileSync('npm', ['run', 'evidence:validate'], { cwd: repoRoot, env, stdio: 'pipe' });
    execFileSync('npm', ['run', 'evidence:import', '--', '--file', 'data/imports/evidence_draft.example.yaml'], {
      cwd: repoRoot,
      env,
      stdio: 'pipe',
    });
    execFileSync('npm', ['run', 'evidence:import', '--', '--file', 'data/imports/evidence_draft.example.yaml'], {
      cwd: repoRoot,
      env,
      stdio: 'pipe',
    });

    const validation = readJson<{ status: string; accepted_count: number }>(root, 'outputs/imports/evidence_validation_report.json');
    const importReport = readJson<{
      status: string;
      accepted_copy_path: string;
      fixture_target_path: string;
      audit_log_path: string;
    }>(root, 'outputs/imports/evidence_import_report.json');
    const rows = parse(readFileSync(resolve(root, importReport.fixture_target_path), 'utf8')) as EvidenceNode[];
    const auditLog = readFileSync(resolve(root, importReport.audit_log_path), 'utf8');

    expect(validation.status).toBe('passed');
    expect(validation.accepted_count).toBe(1);
    expect(importReport.status).toBe('passed');
    expect(existsSync(resolve(root, importReport.accepted_copy_path))).toBe(true);
    expect(readFileSync(resolve(root, 'data/audit/operational_evidence_admission.jsonl'), 'utf8'))
      .toContain('import_bci_medical_rehab_followup_001');
    expect(rows.map((row) => row.evidence_id)).toContain('import_bci_medical_rehab_followup_001');
    expect(rows.filter((row) => row.evidence_id === 'import_bci_medical_rehab_followup_001')).toHaveLength(1);
    expect(rows[0].parent_or_branch).toBe('branch');
    expect(auditLog).toContain('"operator_action":"evidence_import"');
  });

  it('rejects invalid evidence and keeps it out of the pipeline fixture target', () => {
    const root = seedWorkspace();
    const result = spawnSync('npm', ['run', 'evidence:import', '--', '--file', 'data/imports/evidence_draft.invalid.yaml'], {
      cwd: repoRoot,
      env: environment(root),
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    const importReport = readJson<{
      status: string;
      rejected_count: number;
      rejected_copy_path: string;
    }>(root, 'outputs/imports/evidence_import_report.json');
    const fixture = readFileSync(resolve(root, 'data/sample_evidence/manual_imported_evidence.yaml'), 'utf8');

    expect(importReport.status).toBe('failed');
    expect(importReport.rejected_count).toBe(1);
    expect(existsSync(resolve(root, importReport.rejected_copy_path))).toBe(true);
    expect(fixture).not.toContain('invalid_parent_branch_trade_001');
  });
});
