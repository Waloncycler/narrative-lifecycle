import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = process.argv.slice(2);
const file = valueFor('--file') ?? 'data/research_packs/china_innovative_drugs_20260809.yaml';
const useCases = createProductCoreUseCases(repoRoot);
const report = await useCases.runResearchPackUseCase.execute({ file, maxItems: positive(valueFor('--max')), timeoutMs: positive(valueFor('--timeout-ms')) });
// This opt-in creates review candidates with citations. It never imports
// Evidence or changes a lifecycle stage.
const session = args.includes('--prepare-intake') ? useCases.appendRetrievedSourceIntakeUseCase.execute(report.retrieval, { resolveTopics: false }) : null;
console.log(JSON.stringify({ pack_id: report.pack_id, source_targets: report.triage.triaged_lead_count, requested: report.retrieval.requested_count, retrieved: report.retrieval.retrieved_count, citation_ready: report.retrieval.items.filter((item) => item.citation_status === 'ready').length, review_candidates: session?.candidates.length ?? 0, failed: report.retrieval.failed_count, json: '<stored in db>', markdown: '<stored in db>' }, null, 2));

function valueFor(key: string): string | undefined { const index = args.indexOf(key); return index >= 0 ? args[index + 1] : args.find((value) => value.startsWith(`${key}=`))?.slice(key.length + 1); }
function positive(value: string | undefined): number | undefined { if (!value) return undefined; const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1) throw new Error('limits must be positive integers'); return parsed; }
