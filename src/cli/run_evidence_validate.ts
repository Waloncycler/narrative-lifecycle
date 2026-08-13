import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvidenceImportArgs } from '@/features/evidence/ui/evidence_import_args';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';
import type { EvidenceValidationReport } from '@/features/evidence/types/evidence_import';

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
  json: '<stored in db>',
  markdown: '<stored in db>',
}, null, 2));

if (report.status === 'failed') process.exit(1);
