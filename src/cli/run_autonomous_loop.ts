import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';
import { DbIntakeRepository } from '@/platform/io/db_intake_repository';
import { DbTopicRegistryRepository } from '@/platform/io/db_topic_registry_repository';
import { DbAutonomousResearchRepository } from '@/platform/io/db_autonomous_research_repository';
import { AutonomousFeedbackService } from '@/features/research/io/autonomous_feedback_service';
import type { ResearchAgentLoopKind } from '@/features/research/types/research_agent';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const args = process.argv.slice(2);

const kind = (valueFor(args, '--kind') ?? 'deep') as ResearchAgentLoopKind;
const publishAuto = !args.includes('--no-publish');
const maxCycles = Number(valueFor(args, '--max-cycles') ?? '1');
const intervalMinutes = Number(valueFor(args, '--interval-minutes') ?? '15');
const forceRefresh = args.includes('--force-refresh');

const useCases = createProductCoreUseCases(repoRoot);
const intakeRepo = new DbIntakeRepository(repoRoot);
const topicRepo = new DbTopicRegistryRepository(repoRoot);
const autoRepo = new DbAutonomousResearchRepository(repoRoot);
const feedbackService = new AutonomousFeedbackService(repoRoot);

console.log('================================================================');
console.log('🤖 Starting Autonomous Research & Evolution Self-Feedback Loop');
console.log(`Config: kind=${kind} publishAuto=${publishAuto} maxCycles=${maxCycles} interval=${intervalMinutes}m`);
console.log('================================================================\n');

for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
  console.log(`\n▶️ [Cycle ${cycle}/${maxCycles}] Executing Autonomous Research Agent...`);
  const startTime = Date.now();

  try {
    const manifest = await useCases.researchAgentLoopUseCase.execute({
      loop_kind: kind,
      triggered_by: 'scheduler',
      publish_auto: publishAuto,
      force_refresh: forceRefresh || cycle > 1,
      deep_max_rounds: 1,
      deep_queries_per_round: 2,
    });

    console.log(`\n✅ [Cycle ${cycle}/${maxCycles}] Completed in ${Math.round((Date.now() - startTime) / 1000)}s with status=${manifest.status}`);
    console.log(`Metrics: Candidates=${manifest.metrics.candidate_count} | Published=${manifest.metrics.imported_evidence_count} | Drift=${manifest.metrics.drift_detected}`);

    // Self-Feedback & Quality Audit
    console.log('\n📊 Performing Self-Feedback & Gap Audit...');
    let session = null;
    try {
      session = intakeRepo.readLatestSession();
    } catch {}
    const feedback = feedbackService.evaluateRun({
      runId: manifest.run_id,
      session,
      promotionReport: null,
      registry: topicRepo.readTopicRegistry(),
      operationalEvidence: autoRepo.readOperationalEvidence(),
    });

    console.log(`\n📋 Evidence Health Summary:`);
    console.log(`  - Total Candidates Analysed: ${feedback.metrics.total_candidates}`);
    console.log(`  - High-Confidence Resolution Ratio: ${Math.round(feedback.metrics.high_confidence_ratio * 100)}%`);
    console.log(`  - Critical-Gap Topics: ${feedback.topic_gaps.filter((g) => g.gap_severity === 'critical').map((g) => g.topic_name).slice(0, 4).join(', ') || 'None'}`);

    console.log(`\n🎯 Next Autonomous Plan [${feedback.next_cycle_plan.plan_id}]:`);
    for (const p of feedback.next_cycle_plan.priority_topics.slice(0, 3)) {
      console.log(`  * [${p.topic_name}] Query targets: ${p.target_queries.slice(0, 2).join(' | ')}`);
    }

    if (cycle < maxCycles) {
      console.log(`\n⏳ Next cycle will run automatically in ${intervalMinutes} minutes...`);
      await new Promise((r) => setTimeout(r, intervalMinutes * 60 * 1000));
    }
  } catch (error) {
    console.error(`❌ [Cycle ${cycle}/${maxCycles}] Error during execution:`, error);
    if (cycle < maxCycles) {
      console.log('Retrying next cycle in 10 seconds...');
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

console.log('\n🏁 Autonomous self-feedback execution loop complete.');

function valueFor(argv: string[], key: string): string | undefined {
  const index = argv.findIndex((item) => item === key);
  if (index >= 0 && argv[index + 1]) return argv[index + 1];
  const inline = argv.find((item) => item.startsWith(`${key}=`));
  return inline?.slice(key.length + 1);
}
