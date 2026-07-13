import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '../infrastructure/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { runWeeklyUseCase } = createProductCoreUseCases(repoRoot);

try {
  const manifest = runWeeklyUseCase.execute();
  console.log(JSON.stringify({
    run_id: manifest.run_id,
    status: manifest.status,
    current_snapshot_id: manifest.current_snapshot_id,
    previous_snapshot_id: manifest.previous_snapshot_id,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
