import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/file_system_adapters';
import type { ResearchAgentLoopKind } from '@/features/research/types/research_agent';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = process.argv.slice(2);
const kind = (valueFor(args, '--kind') ?? 'manual') as ResearchAgentLoopKind;
const publishAuto = args.includes('--publish-auto');
const deepMaxRounds = valueFor(args, '--max-rounds');
const deepQueriesPerRound = valueFor(args, '--queries-per-round');
const useCases = createProductCoreUseCases(repoRoot);

const manifest = await useCases.researchAgentLoopUseCase.execute({
  loop_kind: kind,
  triggered_by: 'cli',
  publish_auto: publishAuto,
  deep_max_rounds: deepMaxRounds ? Number(deepMaxRounds) : undefined,
  deep_queries_per_round: deepQueriesPerRound ? Number(deepQueriesPerRound) : undefined,
});
console.log(`run_id=${manifest.run_id} status=${manifest.status} loop=${manifest.loop_kind} publication=${publishAuto ? 'requested' : 'review_only'}`);
console.log(
  `metrics sources=${manifest.metrics.sources_completed}/${manifest.metrics.sources_requested} candidates=${manifest.metrics.candidate_count} weekly=${manifest.metrics.weekly_run_id ?? 'none'} cycle=${manifest.metrics.learning_cycle_id ?? 'none'} purged=${manifest.metrics.purged_stale_candidates + manifest.metrics.purged_aged_queue_items} proposals=${manifest.metrics.evolution_proposals} drift=${manifest.metrics.drift_detected}`,
);
if (manifest.loop_kind === 'deep') {
  console.log(`deep_sweep rounds=${manifest.metrics.deep_sweep_rounds} followup_queries=${manifest.metrics.deep_followup_queries} total_queries=${manifest.metrics.web_research_queries} leads=${manifest.metrics.web_research_leads}`);
}
for (const phase of manifest.phases) {
  console.log(`  phase=${phase.phase} status=${phase.status} detail=${phase.detail}`);
}

function valueFor(argv: string[], key: string): string | undefined {
  const index = argv.findIndex((item) => item === key);
  if (index >= 0 && argv[index + 1]) return argv[index + 1];
  const inline = argv.find((item) => item.startsWith(`${key}=`));
  return inline?.slice(key.length + 1);
}
