import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIntakePrepareArgs } from '@/interface/intake_args';
import { createProductCoreUseCases } from '@/infrastructure/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = parseIntakePrepareArgs(process.argv.slice(2));
const { prepareEvidenceIntakeUseCase } = createProductCoreUseCases(repoRoot);
const session = prepareEvidenceIntakeUseCase.execute(args);

console.log(JSON.stringify({
  session_id: session.session_id,
  raw_document_id: session.raw_document.raw_document_id,
  chunk_count: session.chunks.length,
  candidate_count: session.candidates.length,
  workbench: 'outputs/intake/latest_workbench.html',
  review_decisions: 'outputs/intake/latest_review_decisions.yaml',
}, null, 2));
