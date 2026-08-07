import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '../infrastructure/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { pilotReviewUseCase } = createProductCoreUseCases(repoRoot);
const ledger = pilotReviewUseCase.execute();

console.log(JSON.stringify({
  ledger_id: ledger.ledger_id,
  status: ledger.status,
  pilot_topic_count: ledger.pilot_topic_count,
  operator_agreement_rate: ledger.evaluation_summary.operator_agreement_rate,
}, null, 2));
