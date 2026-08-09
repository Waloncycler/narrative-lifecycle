import type { TopicEvolutionTimeline } from '@/features/stages/domain/stage_evolution_reconstructor';
import type { Stage } from '@/features/stages/domain/stages';
import type { HistoricalEvidenceRecoveryReport, HistoricalEvidenceRecoveryTask } from '@/features/research/types/historical_evidence_recovery';

const LAYERS_BY_STAGE: Record<Stage, HistoricalEvidenceRecoveryTask['required_layers']> = {
  S0: ['name'],
  S1: ['name'],
  S2: ['name'],
  S3: ['capital'],
  S4: ['pricing'],
  S5: ['reality'],
  S6: ['reality'],
  S7A: ['reality'],
  S7B: ['reality'],
  S7C: ['reality'],
};

const SOURCES_BY_STAGE: Record<Stage, HistoricalEvidenceRecoveryTask['accepted_source_classes']> = {
  S0: ['official', 'reputable_news'], S1: ['official', 'reputable_news'], S2: ['official', 'reputable_news'],
  S3: ['filing', 'company', 'reputable_news'], S4: ['filing', 'company', 'reputable_news'],
  S5: ['official', 'filing', 'company', 'academic'], S6: ['official', 'filing', 'company', 'academic'],
  S7A: ['filing', 'company', 'reputable_news'], S7B: ['filing', 'company', 'reputable_news'], S7C: ['filing', 'company', 'reputable_news'],
};

/** Turns verified timeline uncertainty into bounded original-source research.
 * It deliberately evaluates parent timelines only: branch evidence can never
 * become a task that claims to repair or raise its parent narrative. */
export function buildHistoricalEvidenceRecovery(input: {
  timelines: TopicEvolutionTimeline[];
  generatedAt: string;
  producerVersion: string;
}): HistoricalEvidenceRecoveryReport {
  const tasks: HistoricalEvidenceRecoveryTask[] = [];
  for (const timeline of input.timelines) {
    if (timeline.history_status === 'no_parent_evidence') {
      tasks.push(taskFor(timeline, 'establish_parent_baseline', ['S2', 'S3', 'S4', 'S5', 'S6'], '母主题没有可用于时间线重建的正式证据；先按阶段门槛补齐可追溯来源，不把分支材料写回母主题。'));
    }
    for (const transition of timeline.transitions) {
      if (transition.missing_intermediate_stages.length) {
        tasks.push(taskFor(timeline, 'fill_stage_gap', transition.missing_intermediate_stages, `在 ${transition.transition_date} 观测到 ${transition.from_stage} 至 ${transition.to_stage} 的跨阶段变化；需要补齐独立的中间门槛证据。`));
      }
    }
    if (timeline.excluded_evidence.length) {
      tasks.push(taskFor(timeline, 'repair_provenance', ['S2'], `有 ${timeline.excluded_evidence.length} 条母主题材料未通过时间线来源或时间核验；需回到原始页面补齐引用、日期、事实、解释与限制。`));
    }
  }
  const ordered = tasks.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.topic_id.localeCompare(b.topic_id) || a.task_id.localeCompare(b.task_id));
  const stageGapTaskCount = ordered.filter((task) => task.kind === 'fill_stage_gap').length;
  const baselineTaskCount = ordered.filter((task) => task.kind === 'establish_parent_baseline').length;
  const provenanceRepairTaskCount = ordered.filter((task) => task.kind === 'repair_provenance').length;
  return {
    artifact_type: 'historical_evidence_recovery_report', schema_version: '1.0.0', producer_version: input.producerVersion,
    recovery_plan_id: `history_recovery_${input.generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
    generated_at: input.generatedAt, timeline_source: 'stage_evolution_timeline',
    status: ordered.length ? 'ready_for_research' : 'insufficient_history', tasks: ordered,
    summary: { topic_count: new Set(input.timelines.map((item) => item.topic_id)).size, task_count: ordered.length, stage_gap_task_count: stageGapTaskCount, baseline_task_count: baselineTaskCount, provenance_repair_task_count: provenanceRepairTaskCount, high_priority_count: ordered.filter((task) => task.priority === 'high').length },
    guardrail_check: { timeline_is_read_only: true, existing_stage_unchanged: true, no_auto_evidence_import: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_registry_mutation: true, no_trading_advice: true },
  };
}

function taskFor(timeline: TopicEvolutionTimeline, kind: HistoricalEvidenceRecoveryTask['kind'], targetStages: Stage[], rationale: string): HistoricalEvidenceRecoveryTask {
  const layers = [...new Set(targetStages.flatMap((stage) => LAYERS_BY_STAGE[stage]))];
  const sourceClasses = [...new Set(targetStages.flatMap((stage) => SOURCES_BY_STAGE[stage]))];
  const sourceHint = sourceClasses.includes('official') ? '官方 政策 监管 原文' : '公司 披露 原始公告';
  return {
    task_id: `${kind}_${timeline.topic_id}_${targetStages.join('_').toLowerCase()}`,
    kind, priority: kind === 'fill_stage_gap' || kind === 'establish_parent_baseline' ? 'high' : 'medium',
    topic_id: timeline.topic_id, topic_name: timeline.topic_name, scope: 'parent', target_stages: targetStages,
    required_layers: layers, accepted_source_classes: sourceClasses,
    search_intents: [`${timeline.topic_name} ${sourceHint}`, `${timeline.topic_name} ${targetStages.join(' ')} 原始来源 日期`],
    rationale, intake_route: 'research_retrieve_then_intake_review', evidence_eligibility: 'context_only',
  };
}

function priorityRank(value: HistoricalEvidenceRecoveryTask['priority']): number { return value === 'high' ? 0 : 1; }
