import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '../infrastructure/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { pilotInitUseCase } = createProductCoreUseCases(repoRoot);

console.log(JSON.stringify(pilotInitUseCase.execute(), null, 2));
