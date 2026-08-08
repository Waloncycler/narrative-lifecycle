import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIntakeEvaluateArgs } from '@/features/intake/ui/intake_args';
import { createProductCoreUseCases } from '@/platform/io/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = parseIntakeEvaluateArgs(process.argv.slice(2));
const { evaluateIntakeUseCase } = createProductCoreUseCases(repoRoot);
const report = evaluateIntakeUseCase.execute(args);

console.log(JSON.stringify({
  evaluation_id: report.evaluation_id,
  session_id: report.session_id,
  candidate_count: report.candidate_count,
  acceptance_rate: report.acceptance_rate,
  modification_rate: report.modification_rate,
  rejection_rate: report.rejection_rate,
  split_rate: report.split_rate,
  field_accuracy: report.field_accuracy,
  average_review_time_seconds: report.average_review_time_seconds,
  duplicate_prevention_count: report.duplicate_prevention_count,
  parent_branch_error_rate: report.parent_branch_error_rate,
  ai_shadow_difference_count: report.ai_shadow_difference_count,
}, null, 2));
