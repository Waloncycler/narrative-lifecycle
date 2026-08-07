import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '../infrastructure/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { buildOperatorReviewUseCase } = createProductCoreUseCases(repoRoot);
const { review } = buildOperatorReviewUseCase.execute();

console.log(JSON.stringify({
  review_id: review.review_id,
  status: review.status,
  run_count: review.run_summary.run_count,
  alerts: review.high_priority_operator_alerts.length,
}, null, 2));
