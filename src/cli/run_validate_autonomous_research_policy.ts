import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const audit = createProductCoreUseCases(repoRoot).validateAutonomousResearchPolicyUseCase.execute();

console.log(JSON.stringify({
  policy_id: audit.policy_id,
  status: audit.status,
  automatic_publication_enabled: audit.automatic_publication_enabled,
  errors: audit.errors,
  warnings: audit.warnings,
  output: 'outputs/governance/latest_autonomous_research_policy_audit.json',
}, null, 2));

if (audit.status === 'failed') process.exit(1);
