import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvidenceImportArgs } from '../interface/evidence_import_args';
import { createProductCoreUseCases } from '../infrastructure/file_system_adapters';
import type { EvidenceImportReport } from '../types/evidence_import';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { file } = parseEvidenceImportArgs(process.argv.slice(2));
const { importEvidenceUseCase } = createProductCoreUseCases(repoRoot);
const result = importEvidenceUseCase.import(file);
const report = result.report as EvidenceImportReport;
const payload = {
  import_id: report.import_id,
  status: report.status,
  accepted_count: report.accepted_count,
  rejected_count: report.rejected_count,
  accepted_copy_path: report.accepted_copy_path,
  fixture_target_path: report.fixture_target_path,
  audit_log_path: report.audit_log_path,
  json: 'outputs/imports/evidence_import_report.json',
  markdown: 'outputs/imports/evidence_import_report.md',
};

if (result.failed) {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(payload, null, 2));
