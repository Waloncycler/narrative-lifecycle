import { resolve } from 'node:path';
import { resolveRunContext } from '@/platform/io/run_context';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';
import { db } from '@/db/index';
import { topics } from '@/db/schema';

export async function executeStageCommand(subCommand: string = 'recompute', args: string[] = []) {
  const root = process.cwd();
  const runContext = resolveRunContext();
  const { recomputeAllTopicStagesUseCase, buildDiffUseCase } = createProductCoreUseCases(root);

  if (subCommand === 'diff') {
    console.log('📊 正在比对上一轮与当前生命周期阶段差异 (Stage Diff)...');
    const diff = buildDiffUseCase.execute(runContext);
    console.log(JSON.stringify(diff, null, 2));
    return;
  }

  // 默认执行 recompute
  console.log('⚡ 正在执行全量题材生命周期阶段重算 (Stage Recomputation)...');
  const state = recomputeAllTopicStagesUseCase.execute(runContext);

  const distribution = state.snapshot.topics.reduce<Record<string, number>>((counts: any, topic: any) => {
    counts[topic.current_stage] = (counts[topic.current_stage] ?? 0) + 1;
    return counts;
  }, {});

  const allRegisteredTopics = db.select().from(topics).all();

  console.log('\n================================================================');
  console.log(`✅ 阶段重算完成！当前纳管题材总数: ${allRegisteredTopics.length} 个`);
  console.log('📊 全景生命周期阶段分布 (Stage Distribution):');
  console.log(JSON.stringify(distribution, null, 2));
  console.log('================================================================');
}
