import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { buildIntakeLearningCycleUseCase } = createProductCoreUseCases(repoRoot);
const cycle = buildIntakeLearningCycleUseCase.execute();

console.log(JSON.stringify({
  cycle_id: cycle.cycle_id,
  cycle_version: cycle.cycle_version,
  observed_candidate_count: cycle.observed_candidate_count,
  proposal_count: cycle.proposals.length,
  high_priority_review_count: cycle.active_learning_queue.filter((item) => item.priority_band === 'high').length,
  promotion_status: cycle.promotion_status,
  rollback_profile_id: cycle.rollback_profile_id,
  advisory_only: cycle.guardrail_check.advisory_only,
}, null, 2));
