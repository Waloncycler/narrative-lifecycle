import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIntakePrepareArgs } from '../interface/intake_args';
import { createProductCoreUseCases } from '../infrastructure/file_system_adapters';

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
  candidates: 'outputs/intake/latest_agent_candidates.json',
  verification: 'outputs/intake/latest_agent_verification.json',
  review: 'outputs/intake/latest_agent_review.md',
}, null, 2));
