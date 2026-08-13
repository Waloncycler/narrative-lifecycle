import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { runAiShadowValidationUseCase } = createProductCoreUseCases(repoRoot);
const result = await runAiShadowValidationUseCase.execute();

console.log(JSON.stringify({
  session_id: result.session.session_id,
  ai_candidate_count: result.session.ai_shadow_candidates?.length ?? 0,
  comparison_count: result.session.candidate_comparisons?.length ?? 0,
  report: '<stored in db>',
  audit: '<stored in db>',
}, null, 2));
