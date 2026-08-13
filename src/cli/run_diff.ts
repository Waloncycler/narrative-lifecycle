import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUN_PIPELINE_FIRST_FOR_DIFF } from '@/app/errors';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';
import { resolveRunContext } from '@/platform/io/run_context';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { buildDiffUseCase } = createProductCoreUseCases(repoRoot);

try {
  const { diff } = buildDiffUseCase.execute(resolveRunContext());
  console.log(JSON.stringify({
    diff_id: diff.diff_id,
    status: diff.status,
    previous_snapshot_id: diff.previous_snapshot_id,
    current_snapshot_id: diff.current_snapshot_id,
    json: '<stored in db>',
    markdown: '<stored in db>',
  }, null, 2));
} catch (error) {
  if (error instanceof Error && error.message === RUN_PIPELINE_FIRST_FOR_DIFF) {
    console.error(RUN_PIPELINE_FIRST_FOR_DIFF);
    process.exit(1);
  }
  throw error;
}
