import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvidenceImportArgs } from '../interface/evidence_import_args';
import { createProductCoreUseCases } from '../infrastructure/file_system_adapters';
import type { EvidenceValidationReport } from '../types/evidence_import';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { file } = parseEvidenceImportArgs(process.argv.slice(2));
const { importEvidenceUseCase } = createProductCoreUseCases(repoRoot);
const report = importEvidenceUseCase.validate(file) as EvidenceValidationReport;

console.log(JSON.stringify({
  validation_id: report.validation_id,
  status: report.status,
  accepted_count: report.accepted_count,
  rejected_count: report.rejected_count,
  json: 'outputs/imports/evidence_validation_report.json',
  markdown: 'outputs/imports/evidence_validation_report.md',
}, null, 2));

if (report.status === 'failed') process.exit(1);
