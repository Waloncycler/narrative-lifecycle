import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '../infrastructure/file_system_adapters';
import { resolveRunContext } from '../infrastructure/run_context';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { runPipelineUseCase } = createProductCoreUseCases(repoRoot);

console.log(JSON.stringify(runPipelineUseCase.execute(resolveRunContext()), null, 2));
