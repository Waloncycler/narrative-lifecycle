import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { loadEvidenceImportDraft } from '../src/services/evidence_import_loader';
import { normalizeEvidenceImport } from '../src/services/evidence_import_normalizer';
import { validateEvidenceImport } from '../src/services/evidence_import_validator';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

describe('evidence import validator', () => {
  it('accepts valid manual evidence drafts and validates them against the import schema', () => {
    const drafts = loadEvidenceImportDraft(repoRoot, 'data/imports/evidence_draft.example.yaml');
    const report = validateEvidenceImport({
      repoRoot,
      drafts,
      sourceFile: 'data/imports/evidence_draft.example.yaml',
      generatedAt: '2026-07-09T00:00:00.000Z',
    });

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const schema = JSON.parse(readFileSync(resolve(repoRoot, 'schemas/evidence_import.schema.json'), 'utf8'));

    expect(ajv.compile(schema)(drafts)).toBe(true);
    expect(report.status).toBe('passed');
    expect(report.accepted_evidence_ids).toContain('import_bci_medical_rehab_followup_001');
    expect(Object.values(report.guardrail_check).every(Boolean)).toBe(true);
  });

  it('rejects invalid evidence before it can enter pipeline fixtures', () => {
    const drafts = loadEvidenceImportDraft(repoRoot, 'data/imports/evidence_draft.invalid.yaml');
    const report = validateEvidenceImport({
      repoRoot,
      drafts,
      sourceFile: 'data/imports/evidence_draft.invalid.yaml',
      generatedAt: '2026-07-09T00:00:00.000Z',
    });

    expect(report.status).toBe('failed');
    expect(report.rejected_evidence_ids).toContain('invalid_parent_branch_trade_001');
    expect(report.errors.map((error) => error.message).join(' ')).toContain('trading advice');
    expect(report.guardrail_check.no_trading_advice).toBe(false);
    expect(report.guardrail_check.parent_branch_scope_valid).toBe(false);
  });

  it('normalizes accepted imports into pipeline EvidenceNode fields without lifting branch scope', () => {
    const drafts = loadEvidenceImportDraft(repoRoot, 'data/imports/evidence_draft.example.yaml');
    const [normalized] = normalizeEvidenceImport({
      drafts,
      sourceFile: 'data/imports/evidence_draft.example.yaml',
      importedAt: '2026-07-09T00:00:00.000Z',
    });

    expect(normalized.import_id).toBe('import_20260709');
    expect(normalized.evidence.parent_or_branch).toBe('branch');
    expect(normalized.evidence.branch_id).toBe('bci_medical_rehab');
    expect(normalized.evidence.affected_layer).toEqual(['reality', 'feedback']);
    expect(normalized.evidence.source_type).toBe('manual_research');
    expect(normalized.evidence.confidence).toBe(70);
  });
});
