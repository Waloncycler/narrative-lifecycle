import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ResearchBaselineCompletionReport } from '@/features/research/types/research_baseline_completion';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';

export class DbResearchBaselineCompletionRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  writeReport(report: ResearchBaselineCompletionReport): void {
    writeGenericArtifact('research/latest_baseline_completion.json', report);
    writeGenericArtifact(`research/history/${report.baseline_plan_id}.json`, report);
    writeGenericTextArtifact('research/latest_baseline_completion.md', renderMarkdown(report));
  }

  readLatestReport(): ResearchBaselineCompletionReport | null {
    const path = 'research/latest_baseline_completion.json';
    if (!existsSync(path)) return null;
    try { return readGenericArtifact(path)! as ResearchBaselineCompletionReport; } catch { return null; }
  }
}

function renderMarkdown(report: ResearchBaselineCompletionReport): string {
  const label = { parent_evidence_baseline: '父主题证据基准', topic_name_verification: '主题命名核验', branch_name_verification: '分支命名核验' } as const;
  return `# 研究基准补全计划\n\n- 父主题证据基准：${report.summary.parent_evidence_baseline_count}\n- 主题命名核验：${report.summary.topic_name_verification_count}\n- 分支命名核验：${report.summary.branch_name_verification_count}\n\n${report.items.map((item) => `- [${item.priority === 'high' ? '高' : '中'}] ${label[item.kind]}：${item.display_name_zh}\n  - ${item.rationale}\n  - 下一步：${item.next_action === 'research_original_sources' ? '检索权威原始来源' : '核验市场名称'}`).join('\n') || '- 当前没有待补全项。'}\n\n> 本计划不是 Evidence，不改变 Stage/Score，也不自动修改登记册。\n`;
}
