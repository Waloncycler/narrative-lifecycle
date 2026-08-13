import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIntakeEvaluateArgs } from '@/features/intake/ui/intake_args';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = parseIntakeEvaluateArgs(process.argv.slice(2));
const { buildIntakeLearningProfileUseCase, buildIntakeLearningCycleUseCase } = createProductCoreUseCases(repoRoot);
const profile = buildIntakeLearningProfileUseCase.execute(args);
const cycle = buildIntakeLearningCycleUseCase.execute();

console.log(JSON.stringify({
  profile_id: profile.profile_id,
  profile_version: profile.profile_version,
  observed_session_count: profile.observed_session_count,
  observed_candidate_count: profile.observed_candidate_count,
  field_corrections: profile.field_corrections,
  topic_corrections: profile.topic_corrections,
  rejection_patterns: profile.rejection_patterns,
  adaptation_mode: profile.adaptation_mode,
  auto_rule_mutation: profile.auto_rule_mutation,
  auto_stage_change: profile.auto_stage_change,
  auto_topic_activation: profile.auto_topic_activation,
  learning_cycle_id: cycle.cycle_id,
  proposal_count: cycle.proposals.length,
  high_priority_review_count: cycle.active_learning_queue.filter((item) => item.priority_band === 'high').length,
  promotion_status: cycle.promotion_status,
}, null, 2));
