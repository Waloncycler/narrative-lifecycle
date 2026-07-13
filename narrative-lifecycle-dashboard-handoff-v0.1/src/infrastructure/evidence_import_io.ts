import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse, stringify } from 'yaml';
import type { EvidenceNode } from '../domain/evidence';
import { validateEvidenceImportDrafts } from '../domain/evidence_import_rules';
import type {
  EvidenceImportAuditRecord,
  EvidenceImportDraft,
  EvidenceImportReport,
  EvidenceValidationIssue,
  EvidenceValidationReport,
  NormalizedEvidenceImport,
} from '../types/evidence_import';
import { RULE_VERSION } from '../domain/versioning_service';

export const DEFAULT_EVIDENCE_IMPORT_FILE = 'data/imports/evidence_draft.example.yaml';
export const IMPORT_OUTPUT_DIR = 'outputs/imports';
export const ACCEPTED_IMPORT_DIR = 'data/imports/accepted';
export const REJECTED_IMPORT_DIR = 'data/imports/rejected';
export const MANUAL_IMPORTED_EVIDENCE_PATH = 'data/sample_evidence/manual_imported_evidence.yaml';
export const EVIDENCE_IMPORT_AUDIT_PATH = 'data/audit/evidence_import_audit.jsonl';

export function loadEvidenceImportDraft(repoRoot: string, sourceFile = DEFAULT_EVIDENCE_IMPORT_FILE): EvidenceImportDraft[] {
  const value = parse(readFileSync(resolve(repoRoot, sourceFile), 'utf8')) as EvidenceImportDraft | EvidenceImportDraft[];
  return Array.isArray(value) ? value : [value];
}

export function parseEvidenceImportArgs(argv: string[]): { file: string } {
  const fileIndex = argv.findIndex((item) => item === '--file');
  if (fileIndex >= 0 && argv[fileIndex + 1]) return { file: argv[fileIndex + 1] };
  const inline = argv.find((item) => item.startsWith('--file='));
  if (inline) return { file: inline.slice('--file='.length) };
  return { file: DEFAULT_EVIDENCE_IMPORT_FILE };
}

function loadExistingEvidenceIds(repoRoot: string): Set<string> {
  const directory = resolve(repoRoot, 'data/sample_evidence');
  if (!existsSync(directory)) return new Set();
  const ids = new Set<string>();
  for (const file of readdirSync(directory).filter((item) => item.endsWith('.yaml') || item.endsWith('.yml'))) {
    if (file === 'manual_imported_evidence.yaml') continue;
    const rows = parse(readFileSync(resolve(directory, file), 'utf8')) as EvidenceNode[];
    for (const row of rows) ids.add(row.evidence_id);
  }
  return ids;
}

function schemaErrors(repoRoot: string, drafts: EvidenceImportDraft[]): EvidenceValidationIssue[] {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(resolve(repoRoot, 'schemas/evidence_import.schema.json'), 'utf8')) as object;
  const validate = ajv.compile(schema);
  if (validate(drafts)) return [];
  return (validate.errors ?? []).map((error) => ({
    evidence_id: 'schema',
    field: error.instancePath || error.schemaPath,
    message: error.message ?? 'schema validation failed',
  }));
}

export function validateEvidenceImport(input: {
  repoRoot: string;
  drafts: EvidenceImportDraft[];
  sourceFile: string;
  generatedAt?: string;
}): EvidenceValidationReport {
  return validateEvidenceImportDrafts({
    drafts: input.drafts,
    sourceFile: input.sourceFile,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    existingEvidenceIds: loadExistingEvidenceIds(input.repoRoot),
    schemaErrors: schemaErrors(input.repoRoot, input.drafts),
  });
}

function writeJson(repoRoot: string, relativePath: string, value: unknown): string {
  const path = resolve(repoRoot, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return relativePath;
}

function writeMarkdown(repoRoot: string, relativePath: string, body: string): string {
  const path = resolve(repoRoot, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return relativePath;
}

function importIdFromReport(report: EvidenceValidationReport): string {
  return `import_${report.generated_at.slice(0, 10).replaceAll('-', '')}`;
}

export function renderEvidenceValidationMarkdown(report: EvidenceValidationReport): string {
  const lines = [
    '# Evidence Validation Report',
    '',
    '## Summary',
    '',
    `- validation_id: ${report.validation_id}`,
    `- source_file: ${report.source_file}`,
    `- status: ${report.status}`,
    `- accepted_count: ${report.accepted_count}`,
    `- rejected_count: ${report.rejected_count}`,
    '',
    '## Accepted Evidence',
    '',
    ...(report.accepted_evidence_ids.length ? report.accepted_evidence_ids.map((id) => `- ${id}`) : ['- none']),
    '',
    '## Rejected Evidence',
    '',
    ...(report.rejected_evidence_ids.length ? report.rejected_evidence_ids.map((id) => `- ${id}`) : ['- none']),
    '',
    '## Warnings',
    '',
    ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning.evidence_id}: ${warning.message}`) : ['- none']),
    '',
    '## Guardrail Check',
    '',
    `- no_trading_advice: ${report.guardrail_check.no_trading_advice}`,
    `- parent_branch_scope_valid: ${report.guardrail_check.parent_branch_scope_valid}`,
    `- evidence_strength_valid: ${report.guardrail_check.evidence_strength_valid}`,
    `- affected_layer_valid: ${report.guardrail_check.affected_layer_valid}`,
    `- source_metadata_present: ${report.guardrail_check.source_metadata_present}`,
    '',
    '## Next Operator Actions',
    '',
    report.status === 'passed'
      ? '- validate: review accepted evidence before running evidence import.'
      : '- request_more_evidence: fix rejected evidence fields and rerun validation.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function renderEvidenceImportMarkdown(report: EvidenceImportReport): string {
  const lines = [
    '# Evidence Import Report',
    '',
    '## Summary',
    '',
    `- import_id: ${report.import_id}`,
    `- source_file: ${report.source_file}`,
    `- status: ${report.status}`,
    `- accepted_count: ${report.accepted_count}`,
    `- rejected_count: ${report.rejected_count}`,
    '',
    '## Accepted Evidence',
    '',
    ...(report.accepted_evidence_ids.length ? report.accepted_evidence_ids.map((id) => `- ${id}`) : ['- none']),
    '',
    '## Rejected Evidence',
    '',
    ...(report.rejected_evidence_ids.length ? report.rejected_evidence_ids.map((id) => `- ${id}`) : ['- none']),
    '',
    '## Written Artifacts',
    '',
    `- accepted_copy_path: ${report.accepted_copy_path ?? 'none'}`,
    `- rejected_copy_path: ${report.rejected_copy_path ?? 'none'}`,
    `- fixture_target_path: ${report.fixture_target_path ?? 'none'}`,
    `- audit_log_path: ${report.audit_log_path ?? 'none'}`,
    '',
    '## Next Operator Actions',
    '',
    report.status === 'passed'
      ? '- validate: run npm run pipeline and npm run report after reviewing imported evidence.'
      : '- request_more_evidence: fix validation errors before importing.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function writeEvidenceValidationReport(repoRoot: string, report: EvidenceValidationReport): void {
  writeJson(repoRoot, `${IMPORT_OUTPUT_DIR}/evidence_validation_report.json`, report);
  writeMarkdown(repoRoot, `${IMPORT_OUTPUT_DIR}/evidence_validation_report.md`, renderEvidenceValidationMarkdown(report));
}

export function writeEvidenceImportAudit(repoRoot: string, record: EvidenceImportAuditRecord): string {
  const path = resolve(repoRoot, EVIDENCE_IMPORT_AUDIT_PATH);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`);
  return EVIDENCE_IMPORT_AUDIT_PATH;
}

export function writeRejectedEvidenceImport(repoRoot: string, report: EvidenceValidationReport, sourceBody: string): EvidenceImportReport {
  const importId = importIdFromReport(report);
  const rejectedCopyPath = `${REJECTED_IMPORT_DIR}/${importId}.yaml`;
  const path = resolve(repoRoot, rejectedCopyPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, sourceBody);

  const importReport: EvidenceImportReport = {
    ...report,
    import_id: importId,
    imported_at: report.generated_at,
    rejected_copy_path: rejectedCopyPath,
  };
  writeJson(repoRoot, `${IMPORT_OUTPUT_DIR}/evidence_import_report.json`, importReport);
  writeMarkdown(repoRoot, `${IMPORT_OUTPUT_DIR}/evidence_import_report.md`, renderEvidenceImportMarkdown(importReport));
  return importReport;
}

export function writeAcceptedEvidenceImport(repoRoot: string, report: EvidenceValidationReport, normalized: NormalizedEvidenceImport[]): EvidenceImportReport {
  const importId = normalized[0]?.import_id ?? importIdFromReport(report);
  const acceptedCopyPath = `${ACCEPTED_IMPORT_DIR}/${importId}.yaml`;
  const acceptedCopy = normalized.map((item) => ({
    import_id: item.import_id,
    imported_at: item.imported_at,
    source_file: item.source_file,
    evidence_hash: item.evidence_hash,
    ...item.draft,
  }));
  const fixtureRows = normalized.map((item) => item.evidence);

  const acceptedPath = resolve(repoRoot, acceptedCopyPath);
  mkdirSync(dirname(acceptedPath), { recursive: true });
  writeFileSync(acceptedPath, stringify(acceptedCopy));

  const fixturePath = resolve(repoRoot, MANUAL_IMPORTED_EVIDENCE_PATH);
  mkdirSync(dirname(fixturePath), { recursive: true });
  writeFileSync(fixturePath, stringify(fixtureRows));

  const auditLogPath = writeEvidenceImportAudit(repoRoot, {
    import_id: importId,
    imported_at: normalized[0]?.imported_at ?? report.generated_at,
    source_file: report.source_file,
    accepted_count: normalized.length,
    rejected_count: 0,
    evidence_ids: normalized.map((item) => item.evidence.evidence_id),
    validation_errors: [],
    operator_action: 'evidence_import',
    rule_version: RULE_VERSION,
  });

  const importReport: EvidenceImportReport = {
    ...report,
    import_id: importId,
    imported_at: normalized[0]?.imported_at ?? report.generated_at,
    accepted_copy_path: acceptedCopyPath,
    fixture_target_path: MANUAL_IMPORTED_EVIDENCE_PATH,
    audit_log_path: auditLogPath,
  };
  writeJson(repoRoot, `${IMPORT_OUTPUT_DIR}/evidence_import_report.json`, importReport);
  writeMarkdown(repoRoot, `${IMPORT_OUTPUT_DIR}/evidence_import_report.md`, renderEvidenceImportMarkdown(importReport));
  return importReport;
}
