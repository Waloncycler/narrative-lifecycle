import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/infrastructure/file_system_adapters';
import type { AiShadowValidationReport } from '@/types/intake';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { runAiShadowCorpusEvaluationUseCase } = createProductCoreUseCases(repoRoot);
const report = await runAiShadowCorpusEvaluationUseCase.execute() as AiShadowValidationReport;

console.log(JSON.stringify({
  report_id: report.report_id,
  document_count: report.document_count,
  rule_only_candidate_count: report.rule_only_candidate_count,
  ai_candidate_count: report.ai_candidate_count,
  fallback_count: report.fallback_count,
  citation_accuracy: report.citation_accuracy,
  output: 'outputs/intake/latest_real_ai_shadow_evaluation.json',
}, null, 2));
