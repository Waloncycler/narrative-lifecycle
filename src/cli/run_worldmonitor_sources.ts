import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const argv = process.argv.slice(2);
const command = argv[0] === 'sync' ? 'sync' : 'inventory';
const mode = valueFor(argv, '--mode') === 'live' ? 'live' : 'sandbox';
const operationIds = valuesFor(argv, '--operation');
const maxOperations = numberFor(argv, '--max');
const { syncWorldMonitorSourcesUseCase, normalizeWorldMonitorDataUseCase } = createProductCoreUseCases(repoRoot);

if (command === 'inventory') {
  const inventory = syncWorldMonitorSourcesUseCase.inventory();
  console.log(`World Monitor inventory: ${inventory.operation_count} operations / ${inventory.service_count} services / ${inventory.sandbox_operation_count} sandbox fixtures.`);
} else {
  const result = await syncWorldMonitorSourcesUseCase.execute({
    mode,
    operationIds: operationIds.length ? operationIds : undefined,
    includeContext: argv.includes('--include-context'),
    maxOperations,
    maxCandidates: numberFor(argv, '--max-candidates'),
    forceRefresh: argv.includes('--force'),
  });
  console.log(`World Monitor ${mode} sync: ${result.report.completed_operation_count} completed, ${result.report.candidate_count} candidates, ${result.report.failed_operation_count} failed.`);
  
  if (normalizeWorldMonitorDataUseCase) {
    const normResult = await normalizeWorldMonitorDataUseCase.execute(100);
    console.log(`World Monitor normalization: ${normResult.processed} snapshots normalized to canonical events & candidates.`);
  }

  if (mode === 'live' && !result.inventory.production_configured) {
    console.log('World Monitor-hosted operations remain blocked until WORLDMONITOR_API_KEY is configured; public direct sources remain available.');
  }
  if (result.session) {
    const fs = await import('node:fs/promises');
    await fs.writeFile('worldmonitor_dump.json', JSON.stringify(result.session.candidates, null, 2), 'utf-8');
    console.log(`Exported ${result.session.candidates.length} candidates to worldmonitor_dump.json`);
  }
}

function valueFor(args: string[], key: string): string | undefined {
  const index = args.indexOf(key);
  if (index >= 0) return args[index + 1];
  return args.find((item) => item.startsWith(`${key}=`))?.slice(key.length + 1);
}

function valuesFor(args: string[], key: string): string[] {
  return args.flatMap((item, index) => item === key && args[index + 1] ? [args[index + 1]] : item.startsWith(`${key}=`) ? [item.slice(key.length + 1)] : []);
}

function numberFor(args: string[], key: string): number | undefined {
  const value = valueFor(args, key);
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${key} must be a positive integer`);
  return parsed;
}
