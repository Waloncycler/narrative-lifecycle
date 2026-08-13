import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIntakePrepareArgs } from '@/features/intake/ui/intake_args';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';

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
  workbench: '<stored in db>',
  review_decisions: '<stored in db>',
}, null, 2));
