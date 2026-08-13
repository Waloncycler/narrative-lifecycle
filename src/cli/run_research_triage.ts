import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const report = createProductCoreUseCases(repoRoot).buildResearchLeadTriageUseCase.execute();

console.log(JSON.stringify({
  triage_id: report.triage_id,
  input_leads: report.input_lead_count,
  triaged_leads: report.triaged_lead_count,
  priority_review: report.summary.priority_review_count,
  review: report.summary.review_count,
  reference_only: report.summary.reference_only_count,
  hold: report.summary.hold_count,
  json: '<stored in db>',
  markdown: '<stored in db>',
}, null, 2));
