import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/infrastructure/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const report = createProductCoreUseCases(repoRoot).buildResearchBaselineCompletionUseCase.execute();
console.log(JSON.stringify({ baseline_plan_id: report.baseline_plan_id, parent_evidence_baselines: report.summary.parent_evidence_baseline_count, topic_name_checks: report.summary.topic_name_verification_count, branch_name_checks: report.summary.branch_name_verification_count, high_priority: report.summary.high_priority_count, json: 'outputs/research/latest_baseline_completion.json' }, null, 2));
