import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUN_PIPELINE_FIRST } from '../application/errors';
import { createProductCoreUseCases } from '../infrastructure/file_system_adapters';
import { resolveRunContext } from '../infrastructure/run_context';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { buildWeeklyBriefUseCase } = createProductCoreUseCases(repoRoot);

try {
  const context = process.env.NARRATIVE_RUN_ID ? resolveRunContext() : undefined;
  const { report } = buildWeeklyBriefUseCase.execute(context);
  console.log(JSON.stringify({
    report_id: report.report_id,
    markdown: 'outputs/reports/weekly_brief.md',
    json: 'outputs/reports/weekly_brief.json',
    system_status: report.executive_summary.system_status,
  }, null, 2));
} catch (error) {
  if (error instanceof Error && error.message === RUN_PIPELINE_FIRST) {
    console.error(RUN_PIPELINE_FIRST);
    process.exit(1);
  }
  throw error;
}
