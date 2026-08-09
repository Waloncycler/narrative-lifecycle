import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const report = createProductCoreUseCases(repoRoot).buildHistoricalEvidenceRecoveryUseCase.execute();
console.log(JSON.stringify({ recovery_plan_id: report.recovery_plan_id, status: report.status, tasks: report.summary.task_count, stage_gaps: report.summary.stage_gap_task_count, baselines: report.summary.baseline_task_count, json: 'outputs/research/latest_historical_evidence_recovery.json' }, null, 2));
