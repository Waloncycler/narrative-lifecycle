import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIntakeApplyArgs } from '@/features/intake/ui/intake_args';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = parseIntakeApplyArgs(process.argv.slice(2));
const {
  applyEvidenceIntakeReviewUseCase,
  validateTopicsUseCase,
  evaluateIntakeUseCase,
  buildIntakeLearningProfileUseCase,
  buildIntakeLearningCycleUseCase,
} = createProductCoreUseCases(repoRoot);
validateTopicsUseCase.execute();
const result = applyEvidenceIntakeReviewUseCase.execute(args);
const evaluation = evaluateIntakeUseCase.execute(args);
const profile = buildIntakeLearningProfileUseCase.execute(args);
const learningCycle = buildIntakeLearningCycleUseCase.execute();

console.log(JSON.stringify({
  session_id: result.session_id,
  imported: result.imported,
  import_status: result.import_status,
  accepted_count: result.accepted_count,
  modified_count: result.modified_count,
  split_count: result.split_count,
  rejected_count: result.rejected_count,
  duplicate_count: result.duplicate_count,
  weekly_run_id: result.weekly_run_id,
  evaluation_id: evaluation.evaluation_id,
  learning_profile_id: profile.profile_id,
  learning_cycle_id: learningCycle.cycle_id,
  learning_promotion_status: learningCycle.promotion_status,
}, null, 2));

if ((!result.imported && result.accepted_count > 0) || result.duplicate_count > 0) process.exit(1);
