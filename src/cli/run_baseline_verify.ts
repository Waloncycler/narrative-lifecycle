import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = process.argv.slice(2);
const maxTopics = readPositiveInt('--max-topics', 3);
const maxEvidence = readPositiveInt('--max-evidence', 6);
const maxSources = readPositiveInt('--max-sources', 4);
const requestedTopicIds = readRepeatable('--topic');
const publish = args.includes('--publish-auto');
const useCases = createProductCoreUseCases(repoRoot);

const result = await useCases.verifyBaselineEvidenceUseCase.execute({
  topicIds: requestedTopicIds,
  maxTopics,
  maxEvidence,
  maxSources,
  publish,
});

console.log(JSON.stringify({
  baseline_report_id: result.baseline.report_id,
  selected_topics: result.selectedTopicIds,
  requested_evidence: result.requestedEvidenceIds.length,
  recovery_run_id: result.recovered.report.recovery_run_id,
  recovered: result.recovered.report.recovered_target_count,
  auto_intake_ready: result.recovered.report.auto_intake_ready_count,
  citation_ready_unverified: result.recovered.report.citation_ready_unverified_count,
  insufficient: result.recovered.report.insufficient_count,
  policy_publication_requested: publish,
  autonomy: result.autonomy,
  json: '<stored in db>',
}, null, 2));

function readPositiveInt(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? Number(process.argv[index + 1]) : fallback;
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readRepeatable(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]?.trim()) values.push(process.argv[index + 1]!.trim());
  }
  return values;
}
