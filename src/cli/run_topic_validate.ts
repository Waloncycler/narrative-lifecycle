import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { validateTopicsUseCase } = createProductCoreUseCases(repoRoot);
const audit = validateTopicsUseCase.execute();

console.log(JSON.stringify({
  audit_id: audit.audit_id,
  status: audit.registry_validation.status,
  resolution_count: audit.resolutions.length,
  unresolved_count: audit.unresolved_queue.length,
  topic_count: audit.registry_validation.topic_count,
  alias_count: audit.registry_validation.alias_count,
  branch_count: audit.registry_validation.branch_count,
}, null, 2));

if (audit.registry_validation.status === 'failed') process.exit(1);
