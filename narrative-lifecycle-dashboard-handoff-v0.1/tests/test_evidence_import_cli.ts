import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { EvidenceNode } from '../src/domain/evidence';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8')) as T;
}

describe('evidence import CLI', () => {
  it('validates and imports accepted evidence with normalized copy and audit log', () => {
    execFileSync('npm', ['run', 'evidence:validate'], { cwd: repoRoot, stdio: 'pipe' });
    execFileSync('npm', ['run', 'evidence:import', '--', '--file', 'data/imports/evidence_draft.example.yaml'], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
    execFileSync('npm', ['run', 'evidence:import', '--', '--file', 'data/imports/evidence_draft.example.yaml'], {
      cwd: repoRoot,
      stdio: 'pipe',
    });

    const validation = readJson<{ status: string; accepted_count: number }>('outputs/imports/evidence_validation_report.json');
    const importReport = readJson<{
      status: string;
      accepted_copy_path: string;
      fixture_target_path: string;
      audit_log_path: string;
    }>('outputs/imports/evidence_import_report.json');
    const rows = parse(readFileSync(resolve(repoRoot, importReport.fixture_target_path), 'utf8')) as EvidenceNode[];
    const auditLog = readFileSync(resolve(repoRoot, importReport.audit_log_path), 'utf8');

    expect(validation.status).toBe('passed');
    expect(validation.accepted_count).toBe(1);
    expect(importReport.status).toBe('passed');
    expect(existsSync(resolve(repoRoot, importReport.accepted_copy_path))).toBe(true);
    expect(rows.map((row) => row.evidence_id)).toContain('import_bci_medical_rehab_followup_001');
    expect(rows.filter((row) => row.evidence_id === 'import_bci_medical_rehab_followup_001')).toHaveLength(1);
    expect(rows[0].parent_or_branch).toBe('branch');
    expect(auditLog).toContain('"operator_action":"evidence_import"');
  });

  it('rejects invalid evidence and keeps it out of the pipeline fixture target', () => {
    const result = spawnSync('npm', ['run', 'evidence:import', '--', '--file', 'data/imports/evidence_draft.invalid.yaml'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    const importReport = readJson<{
      status: string;
      rejected_count: number;
      rejected_copy_path: string;
    }>('outputs/imports/evidence_import_report.json');
    const fixture = readFileSync(resolve(repoRoot, 'data/sample_evidence/manual_imported_evidence.yaml'), 'utf8');

    expect(importReport.status).toBe('failed');
    expect(importReport.rejected_count).toBe(1);
    expect(existsSync(resolve(repoRoot, importReport.rejected_copy_path))).toBe(true);
    expect(fixture).not.toContain('invalid_parent_branch_trade_001');
  });
});
