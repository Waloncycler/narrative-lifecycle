import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';
import { convertRetrievalToRawDocuments } from '@/features/intake/domain/intake_rules';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const useCases = createProductCoreUseCases(repoRoot);

const path = resolve(repoRoot, '<stored in db>');

if (!existsSync(path)) {
  console.error(`Retrieval report not found at ${path}`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(path, 'utf8')) as ResearchSourceRetrievalReport;
const rawDocs = convertRetrievalToRawDocuments(report);

if (rawDocs.length === 0) {
  console.log('No citation-ready retrieval packages found in the latest report.');
  process.exit(0);
}

console.log(`Converted ${rawDocs.length} raw documents from retrieval. Running intake...`);

for (const rawDoc of rawDocs) {
  console.log(`Running intake for ${rawDoc.source_name}...`);
  const bundle = await useCases.runIntakeAgentUseCase.execute({ text: rawDoc.text });
  console.log(`Intake complete for ${rawDoc.source_name}. Generated ${bundle.candidates.length} candidates.`);
}

console.log('Check <stored in db> for details.');
