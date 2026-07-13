import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUN_PIPELINE_FIRST_FOR_DIFF } from '../application/errors';
import { createProductCoreUseCases } from '../infrastructure/file_system_adapters';
import { resolveRunContext } from '../infrastructure/run_context';

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
    json: 'outputs/diffs/latest_stage_diff.json',
    markdown: 'outputs/diffs/latest_stage_diff.md',
  }, null, 2));
} catch (error) {
  if (error instanceof Error && error.message === RUN_PIPELINE_FIRST_FOR_DIFF) {
    console.error(RUN_PIPELINE_FIRST_FOR_DIFF);
    process.exit(1);
  }
  throw error;
}
