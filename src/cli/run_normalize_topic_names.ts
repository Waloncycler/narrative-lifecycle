import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';
import { createRunContext } from '@/platform/io/run_context';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { normalizeTopicNamesUseCase, recomputeAllTopicStagesUseCase } = createProductCoreUseCases(repoRoot);
const report = normalizeTopicNamesUseCase.execute();
const state = recomputeAllTopicStagesUseCase.execute(createRunContext());

console.log(JSON.stringify({
  localized_count: report.localized_count,
  merged_count: report.merged_count,
  unresolved_english_count: report.unresolved_english_count,
  visible_topic_count: state.snapshot.topics.length,
}, null, 2));
