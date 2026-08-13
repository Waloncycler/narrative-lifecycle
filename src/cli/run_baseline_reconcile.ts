import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const report = createProductCoreUseCases(repoRoot).reconcileBaselineEvidenceUseCase.execute();
console.log(JSON.stringify({ report_id: report.report_id, ...report.summary }, null, 2));
