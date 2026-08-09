import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = process.argv.slice(2);
// The command is review-only by default. `--publish-auto` is intentionally
// explicit and still requires auto_publish_evidence=true in the policy file.
const publish = args.includes('--publish-auto');
const result = createProductCoreUseCases(repoRoot).runAutonomousResearchUseCase.execute({ publish });

console.log(`run_id=${result.report.run_id} mode=${result.report.publication_mode} requested=${result.report.publication_requested} published=${result.report.published_count} held=${result.report.held_count} rejected=${result.report.rejected_count}`);
console.log(`topics=${result.snapshot.topics.length} stage_changes=${result.diff.summary.stage_upgrade_count + result.diff.summary.stage_downgrade_count}`);
