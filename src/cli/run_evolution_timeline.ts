/**
 * Stage Evolution Timeline CLI
 *
 * Reconstructs and outputs the complete stage evolution history for
 * all registered topics, showing WHEN each stage transition happened
 * and WHICH evidence triggered it.
 *
 * Usage: npx tsx src/cli/run_evolution_timeline.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TopicEvolutionTimeline } from '@/features/stages/domain/stage_evolution_reconstructor';
import { FileSchemaValidator } from '@/platform/io/app_di_container';
import { DbEvolutionTimelineRepository } from '@/platform/io/db_evolution_timeline_repository';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(__dirname, '..', '..');

function printTimeline(timeline: TopicEvolutionTimeline): void {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`📊 ${timeline.topic_name} (${timeline.topic_id})`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`   首次出现: ${timeline.first_emergence_date}`);
  console.log(`   首次可获得: ${timeline.first_available_at}`);
  console.log(`   当前阶段: ${timeline.current_stage}`);
  console.log(`   演化路径: ${timeline.evolution_path}`);
  console.log(`   证据总数: ${timeline.total_evidence_count}（可用于重建的母主题证据: ${timeline.eligible_parent_evidence_count}）`);
  console.log(`   历史可信度: ${timeline.history_status} — ${timeline.history_status_reason}`);

  if (timeline.transitions.length > 0) {
    console.log(`\n   ⏱️  阶段跃迁时间线:`);
    for (const t of timeline.transitions) {
      console.log(`   ┌─ ${t.transition_date}: ${t.from_stage} → ${t.to_stage}`);
      console.log(`   │  触发证据: ${t.trigger_evidence_title}`);
      console.log(`   │  门槛突破: ${t.gate_unlocked}`);
      if (t.missing_intermediate_stages.length) console.log(`   │  历史缺口: ${t.missing_intermediate_stages.join(', ')}`);
      console.log(`   │  累计证据: ${t.cumulative_evidence_ids.length} 条`);
      console.log(`   └─ 门槛状态: label=${t.gate_state.hasStableLabel ? '✅' : '❌'} capital=${t.gate_state.hasCapitalConfirmation ? '✅' : '❌'} pricing=${t.gate_state.hasPricingAdoption ? '✅' : '❌'} reality=${t.gate_state.hasHardRealityEvidence ? '✅' : '❌'}`);
    }
  } else if (timeline.current_stage === 'S0') {
    console.log(`\n   ⚠️  尚无母主题证据，无阶段跃迁记录`);
  }

  if (timeline.evidence_timeline.length > 0) {
    console.log(`\n   📋 证据时间线:`);
    for (const e of timeline.evidence_timeline) {
      const marker = e.caused_transition ? '🔺' : '  ';
      console.log(`   ${marker} ${e.event_date} | ${e.stage_after} | [${e.evidence_strength}] ${e.event_title.slice(0, 60)}`);
    }
  }
}

// Main
const timelines = new DbEvolutionTimelineRepository().readAll();
console.log(`已从数据库重建 ${timelines.length} 个主题的演化时间线`);
new FileSchemaValidator().validate('stage_evolution_timeline.schema.json', timelines);

// Print to console
for (const tl of timelines) {
  printTimeline(tl);
}

// Write structured JSON output
const outputDir = resolve(repoRoot, 'outputs/evolution_timelines');
mkdirSync(outputDir, { recursive: true });

const outputPath = resolve(outputDir, 'all_topics_evolution.json');
writeFileSync(outputPath, JSON.stringify(timelines, null, 2) + '\n');
console.log(`\n✅ 演化时间线已保存至: ${outputPath}`);

// Write summary
const summaryPath = resolve(outputDir, 'evolution_summary.json');
const summary = timelines.map((tl) => ({
  topic_id: tl.topic_id,
  topic_name: tl.topic_name,
  first_emergence: tl.first_emergence_date,
  current_stage: tl.current_stage,
  evolution_path: tl.evolution_path,
  transition_count: tl.transitions.length,
  total_evidence: tl.total_evidence_count,
}));
writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
console.log(`📊 演化摘要已保存至: ${summaryPath}`);
