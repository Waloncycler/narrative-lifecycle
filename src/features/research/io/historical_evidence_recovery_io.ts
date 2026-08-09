import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HistoricalEvidenceRecoveryReport } from '@/features/research/types/historical_evidence_recovery';
import type { TopicEvolutionTimeline } from '@/features/stages/domain/stage_evolution_reconstructor';
import { writeJsonAtomically, writeTextAtomically } from '@/platform/io/run_manifest_writer';

export class FileHistoricalEvidenceRecoveryRepository {
  constructor(private readonly repoRoot: string) {}

  readTimelines(): TopicEvolutionTimeline[] | null {
    const path = resolve(this.repoRoot, 'outputs/evolution_timelines/all_topics_evolution.json');
    if (!existsSync(path)) return null;
    try {
      const value = JSON.parse(readFileSync(path, 'utf8')) as unknown;
      return Array.isArray(value) ? value as TopicEvolutionTimeline[] : null;
    } catch { return null; }
  }

  writeReport(report: HistoricalEvidenceRecoveryReport): void {
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/research/latest_historical_evidence_recovery.json'), report);
    writeJsonAtomically(resolve(this.repoRoot, `outputs/research/history/${report.recovery_plan_id}.json`), report);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/research/latest_historical_evidence_recovery.md'), renderMarkdown(report));
  }
}

function renderMarkdown(report: HistoricalEvidenceRecoveryReport): string {
  const lines = [
    '# 历史证据恢复计划', '', `- 状态：${report.status === 'ready_for_research' ? '待开展来源研究' : '历史数据不足'}`,
    `- 主题：${report.summary.topic_count}`, `- 任务：${report.summary.task_count}`, `- 跨阶段缺口：${report.summary.stage_gap_task_count}`, `- 母主题基准缺口：${report.summary.baseline_task_count}`, `- 来源修复：${report.summary.provenance_repair_task_count}`, '', '## 待办', '',
    ...(report.tasks.length ? report.tasks.map((task) => `- [${task.priority === 'high' ? '高' : '中'}] ${task.topic_name}：补 ${task.target_stages.join('、')}\n  - 证据层：${task.required_layers.join('、')}；来源：${task.accepted_source_classes.join('、')}\n  - 原因：${task.rationale}\n  - 路径：检索原始页面 → 提取可定位引用 → Intake 人工审核 → 既有 Evidence 导入`) : ['- 当前没有可从时间线推导出的恢复任务。']),
    '', '> 本计划只生成研究任务，不改 Stage/Score，不自动导入 Evidence，不以分支材料抬高母主题。', '',
  ];
  return `${lines.join('\n')}\n`;
}
