import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { runGateAcquisitionUseCase } = createProductCoreUseCases(repoRoot);

function numericArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  return index >= 0 ? Math.max(1, Number(process.argv[index + 1]) || fallback) : fallback;
}

const report = await runGateAcquisitionUseCase.execute({
  maxTasks: numericArg('--max-tasks', 8),
  queriesPerTask: numericArg('--queries-per-task', 4),
  maxRetrieved: numericArg('--max-retrieved', 24),
});

console.log(JSON.stringify({
  status: report.status,
  selected_task_count: report.selected_task_count,
  query_count: report.query_count,
  search_lead_count: report.search_lead_count,
  citation_ready_count: report.citation_ready_count,
  intake_candidate_count: report.intake_candidate_count,
  published_evidence_count: report.published_evidence_count,
  minimax_used: report.minimax_used,
}, null, 2));
