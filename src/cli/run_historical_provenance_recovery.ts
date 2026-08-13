import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = new Set(process.argv.slice(2));
const maxTargets = readPositiveInt('--max-targets', 3);
const maxSourcesPerTarget = readPositiveInt('--max-sources', 4);
const publish = args.has('--publish-auto');
const evidenceIds = readRepeatable('--evidence-id');
const useCases = createProductCoreUseCases(repoRoot);

const recovered = await useCases.recoverHistoricalProvenanceUseCase.execute({ maxTargets, maxSourcesPerTarget, evidenceIds });
const session = useCases.appendRetrievedSourceIntakeUseCase.execute(recovered.retrieval);
let autonomy: { published: number; held: number } | null = null;
if (recovered.report.auto_intake_ready_count && session) {
  const bundle = await useCases.runIntakeAgentUseCase.executeLatest();
  await useCases.runAiShadowValidationUseCase.execute();
  const result = useCases.runAutonomousResearchUseCase.execute({ bundle, publish });
  autonomy = { published: result.report.published_count, held: result.report.held_count };
}

console.log(JSON.stringify({
  recovery_run_id: recovered.report.recovery_run_id,
  requested: recovered.report.requested_target_count,
  recovered: recovered.report.recovered_target_count,
  auto_intake_ready: recovered.report.auto_intake_ready_count,
  citation_ready_unverified: recovered.report.citation_ready_unverified_count,
  insufficient: recovered.report.insufficient_count,
  policy_publication_requested: publish,
  autonomy,
  json: '<stored in db>',
}, null, 2));

function readPositiveInt(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readRepeatable(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]?.trim()) values.push(process.argv[index + 1]!.trim());
  }
  return values;
}
