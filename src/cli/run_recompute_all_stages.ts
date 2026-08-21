import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';
import { resolveRunContext } from '@/platform/io/run_context';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { recomputeAllTopicStagesUseCase } = createProductCoreUseCases(repoRoot);
const state = recomputeAllTopicStagesUseCase.execute(resolveRunContext());
const distribution = state.snapshot.topics.reduce<Record<string, number>>((counts: any, topic: any) => {
  counts[topic.current_stage] = (counts[topic.current_stage] ?? 0) + 1;
  return counts;
}, {});

console.log(JSON.stringify({
  run_id: state.snapshot.run_id,
  topic_count: state.snapshot.topics.length,
  score_count: state.scores.length,
  stage_distribution: distribution,
  database_writeback: true,
}, null, 2));
