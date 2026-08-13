import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const manifest = await createProductCoreUseCases(repoRoot).researchAgentLoopUseCase.execute({
  loop_kind: 'daily', triggered_by: 'cli', publish_auto: true,
});
console.log(JSON.stringify({ run_id: manifest.run_id, status: manifest.status, candidates: manifest.metrics.candidate_count, published_evidence: manifest.metrics.imported_evidence_count, weekly_run_id: manifest.metrics.weekly_run_id, partial: manifest.metrics.drift_detected }, null, 2));
