import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const argv = process.argv.slice(2);
const topicIds = valuesFor(argv, '--topic');
const queries = valuesFor(argv, '--query');
const report = await createProductCoreUseCases(repoRoot).runWebResearchUseCase.execute({
  topicIds: topicIds.length ? topicIds : undefined,
  queries: queries.length ? queries : undefined,
  limit: positiveInt(valueFor(argv, '--limit')),
});

console.log(JSON.stringify({
  status: report.status,
  providers: report.providers.length ? report.providers : [report.provider],
  queries: report.queries.length,
  leads: report.lead_count,
  errors: report.errors,
  json: '<stored in db>',
  markdown: '<stored in db>',
}, null, 2));

function valueFor(args: string[], key: string): string | undefined {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : args.find((item) => item.startsWith(`${key}=`))?.slice(key.length + 1);
}

function valuesFor(args: string[], key: string): string[] {
  return args.flatMap((item, index) => item === key && args[index + 1] ? [args[index + 1]] : item.startsWith(`${key}=`) ? [item.slice(key.length + 1)] : []);
}

function positiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error('--limit must be a positive integer');
  return parsed;
}
