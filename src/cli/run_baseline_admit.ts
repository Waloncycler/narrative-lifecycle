import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = process.argv.slice(2);
const topicId = valueFor(args, '--topic');
const reviewer = valueFor(args, '--reviewer');
if (!topicId || !reviewer) throw new Error('Usage: npm run baseline:admit -- --topic <topic_id> --reviewer <named_reviewer>');

const useCases = createProductCoreUseCases(repoRoot);
const admitted = useCases.admitBaselineEvidenceUseCase.execute({ topicId, reviewer });
const run = useCases.runAutonomousResearchUseCase.execute({ publish: false });
console.log(JSON.stringify({
  admission_id: admitted.admission_id,
  topic_id: topicId,
  report_id: admitted.report.report_id,
  operator_run_id: run.manifest.run_id,
  stage: run.snapshot.topics.find((topic) => topic.topic_id === topicId)?.current_stage ?? null,
}, null, 2));

function valueFor(args: string[], key: string): string | undefined {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : args.find((item) => item.startsWith(`${key}=`))?.slice(key.length + 1);
}
