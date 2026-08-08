import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/infrastructure/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = process.argv.slice(2);
const report = await createProductCoreUseCases(repoRoot).retrieveResearchSourcesUseCase.execute({ maxItems: positive(valueFor('--max')), timeoutMs: positive(valueFor('--timeout-ms')) });
console.log(JSON.stringify({ retrieval_run_id: report.retrieval_run_id, requested: report.requested_count, retrieved: report.retrieved_count, skipped: report.skipped_count, failed: report.failed_count, json: 'outputs/research/latest_source_retrieval.json' }, null, 2));

function valueFor(key: string): string | undefined { const index = args.indexOf(key); return index >= 0 ? args[index + 1] : args.find((value) => value.startsWith(`${key}=`))?.slice(key.length + 1); }
function positive(value: string | undefined): number | undefined { if (!value) return undefined; const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1) throw new Error('limits must be positive integers'); return parsed; }
