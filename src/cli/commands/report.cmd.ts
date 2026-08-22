import { createProductCoreUseCases } from '@/platform/io/app_di_container';
import { resolveRunContext } from '@/platform/io/run_context';
import { RUN_PIPELINE_FIRST } from '@/app/errors';

export async function executeReportCommand(subAction: string = 'daily', _args: string[] = []) {
  const repoRoot = process.cwd();
  const { buildWeeklyBriefUseCase } = createProductCoreUseCases(repoRoot);

  try {
    const context = process.env.NARRATIVE_RUN_ID ? resolveRunContext() : undefined;
    const { report } = buildWeeklyBriefUseCase.execute(context);
    console.log(
      JSON.stringify(
        {
          report_id: report.report_id,
          system_status: report.executive_summary.system_status,
          markdown: '<stored in db & outputs/intelligence/daily_intelligence_latest.md>',
        },
        null,
        2
      )
    );
  } catch (error) {
    if (error instanceof Error && error.message === RUN_PIPELINE_FIRST) {
      console.error('⚠️ 请先运行一次全量流水线: npm run narrative run');
      return 1;
    }
    throw error;
  }
}
