/**
 * Evidence gate-coverage / acquisition worklist report.
 *
 * Reads the operational evidence + topic registry from the DB and prints, per
 * topic × per stage gate, how much independent-publisher support exists — and a
 * ranked worklist of what to collect next. This is where "the stage looks wrong"
 * becomes "this gate rests on one source, go find another".
 *
 * Reads directly (diagnostic, like run_db_migrate); does not mutate anything.
 *
 *   npm run coverage:gates
 *   npm run coverage:gates -- --top 20
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DbAutonomousResearchRepository } from '@/platform/io/db_autonomous_research_repository';
import { DbTopicRegistryRepository } from '@/platform/io/db_topic_registry_repository';
import { buildEvidenceGateCoverage } from '@/features/research/domain/evidence_gate_coverage';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const topArg = process.argv.indexOf('--top');
const topN = topArg >= 0 ? Number(process.argv[topArg + 1]) || 25 : 25;

const evidence = new DbAutonomousResearchRepository(repoRoot).readOperationalEvidence();
const registry = new DbTopicRegistryRepository(repoRoot).readTopicRegistry();

const report = buildEvidenceGateCoverage({
  topics: registry.canonical_topics.map((t) => ({
    topic_id: t.topic_id,
    topic_name: t.topic_name,
    current_stage: t.current_stage,
    status: t.status,
  })),
  evidence,
  asOf: new Date().toISOString(),
  onlyWithEvidence: true,
});

const outDir = resolve(repoRoot, 'outputs/research');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'latest_gate_coverage.json'), JSON.stringify(report, null, 2));

const verdictTally = report.acquisition_worklist.reduce<Record<string, number>>((acc, task) => {
  acc[task.verdict] = (acc[task.verdict] ?? 0) + 1;
  return acc;
}, {});

console.log(`Gate coverage over ${report.topic_count} evidenced topics (as-of ${report.as_of.slice(0, 10)})`);
console.log(`Worklist: ${report.acquisition_worklist.length} gaps — ${JSON.stringify(verdictTally)}`);
console.log(`Top ${Math.min(topN, report.acquisition_worklist.length)} acquisition targets:\n`);
for (const task of report.acquisition_worklist.slice(0, topN)) {
  const head = `${task.topic_name}  ·  ${task.gate}→${gateStage(task.gate)}  [${task.verdict}]`;
  console.log(`  ${head}`);
  console.log(`      support=${task.net_support} publishers=${task.independent_publishers}  → 找: ${task.suggested_targets.slice(0, 2).join('；')}`);
}
console.log(`\nFull report: outputs/research/latest_gate_coverage.json`);

function gateStage(gate: string): string {
  return { stable_label: 'S3', capital: 'S4', pricing: 'S5', hard_reality: 'S6' }[gate] ?? '?';
}
