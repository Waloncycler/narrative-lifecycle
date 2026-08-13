import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = process.argv.slice(2);
const useCases = createProductCoreUseCases(repoRoot);
const result = await useCases.runResearchCampaignUseCase.execute({
  maxTasks: positiveInt(valueFor(args, '--max-tasks')),
  maxQueries: positiveInt(valueFor(args, '--max-queries')),
});

console.log(JSON.stringify({
  campaign_id: result.campaign.campaign_id,
  tasks: result.campaign.summary.task_count,
  source_targets: result.campaign.summary.source_target_count,
  search_status: result.webResearch.status,
  search_queries: result.webResearch.queries.length,
  leads: result.webResearch.lead_count,
  direct_source_status: result.directSourceResearch.status,
  direct_source_queries: result.directSourceResearch.queries.filter((query) => query.status !== 'skipped').length,
  direct_source_leads: result.directSourceResearch.lead_count,
  triaged_leads: result.leadTriage?.triaged_lead_count ?? 0,
  priority_review_leads: result.leadTriage?.summary.priority_review_count ?? 0,
  source_pages_retrieved: result.sourceRetrieval?.retrieved_count ?? 0,
  source_page_failures: result.sourceRetrieval?.failed_count ?? 0,
  json: '<stored in db>',
  markdown: '<stored in db>',
  direct_source_json: '<stored in db>',
  triage_json: '<stored in db>',
}, null, 2));

function valueFor(args: string[], key: string): string | undefined {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : args.find((item) => item.startsWith(`${key}=`))?.slice(key.length + 1);
}

function positiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error('limits must be positive integers');
  return parsed;
}
