/**
 * Stage Evolution Timeline CLI
 *
 * Reconstructs and outputs the complete stage evolution history for
 * all registered topics, showing WHEN each stage transition happened
 * and WHICH evidence triggered it.
 *
 * Usage: npx tsx src/cli/run_evolution_timeline.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconstructAllTopicEvolutions, type TopicEvolutionTimeline } from '@/features/stages/domain/stage_evolution_reconstructor';
import { FileAutonomousResearchRepository } from '@/features/research/io/autonomous_research_io';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(__dirname, '..', '..');

// Read the same operational Evidence Table the stage snapshot is built from —
// audited manual rows, published automated rows, and the JSON table — so the
// timeline and the snapshot can never disagree about a topic's stage.
function loadAllEvidence(): EvidenceNode[] {
  return new FileAutonomousResearchRepository(repoRoot).readOperationalEvidence();
}

// Load topic registry
function loadTopicRegistry(): Array<{ topic_id: string; topic_name: string }> {
  const registryPath = resolve(repoRoot, 'data/topic_registry/topic_registry.json');
  try {
    const content = readFileSync(registryPath, 'utf8');
    const parsed = JSON.parse(content);
    if (parsed.topics && Array.isArray(parsed.topics)) {
      return parsed.topics.map((t: { topic_id: string; topic_name: string }) => ({
        topic_id: t.topic_id,
        topic_name: t.topic_name,
      }));
    }
  } catch {
    // Fallback: extract from snapshot
  }

  // Fallback: extract unique topic_ids from evidence
  const snapshotPath = resolve(repoRoot, 'outputs/operator_runs/latest_stage_snapshot.json');
  try {
    const content = readFileSync(snapshotPath, 'utf8');
    const parsed = JSON.parse(content);
    if (parsed.topics && Array.isArray(parsed.topics)) {
      return parsed.topics.map((t: { topic_id: string; topic_name: string }) => ({
        topic_id: t.topic_id,
        topic_name: t.topic_name,
      }));
    }
  } catch {
    // empty
  }

  return [];
}

function printTimeline(timeline: TopicEvolutionTimeline): void {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`📊 ${timeline.topic_name} (${timeline.topic_id})`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`   首次出现: ${timeline.first_emergence_date}`);
  console.log(`   当前阶段: ${timeline.current_stage}`);
  console.log(`   演化路径: ${timeline.evolution_path}`);
  console.log(`   证据总数: ${timeline.total_evidence_count}`);

  if (timeline.transitions.length > 0) {
    console.log(`\n   ⏱️  阶段跃迁时间线:`);
    for (const t of timeline.transitions) {
      console.log(`   ┌─ ${t.transition_date}: ${t.from_stage} → ${t.to_stage}`);
      console.log(`   │  触发证据: ${t.trigger_evidence_title}`);
      console.log(`   │  门槛突破: ${t.gate_unlocked}`);
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
const allEvidence = loadAllEvidence();
const topicRegistry = loadTopicRegistry();

console.log(`📦 已加载 ${allEvidence.length} 条证据, ${topicRegistry.length} 个主题`);

const timelines = reconstructAllTopicEvolutions(allEvidence, topicRegistry);

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
