import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIntakePrepareArgs } from '@/features/intake/ui/intake_args';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = parseIntakePrepareArgs(process.argv.slice(2));
const { runIntakeAgentUseCase } = createProductCoreUseCases(repoRoot);
const bundle = await runIntakeAgentUseCase.execute(args);

console.log(JSON.stringify({
  agent_version: bundle.agent_version,
  session_id: bundle.session_id,
  candidate_count: bundle.candidates.length,
  passed_count: bundle.verification.passed_count,
  failed_count: bundle.verification.failed_count,
  fallback_count: bundle.verification.fallback_count,
  import_permission: bundle.import_permission,
  candidates: '<stored in db>',
  verification: '<stored in db>',
  review: '<stored in db>',
}, null, 2));
