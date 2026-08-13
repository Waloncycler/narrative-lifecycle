import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const { replayUseCase } = createProductCoreUseCases(repoRoot);
const ledger = replayUseCase.execute();

console.log(JSON.stringify({
  ledger_id: ledger.ledger_id,
  status: ledger.status,
  case_count: ledger.case_count,
  misclassification_count: ledger.aggregate.misclassification_count,
  missed_change_count: ledger.aggregate.missed_change_count,
}, null, 2));
