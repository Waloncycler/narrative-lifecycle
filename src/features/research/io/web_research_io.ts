import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { WebResearchReport } from '@/features/research/types/web_research';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';

export class DbWebResearchRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  writeReport(report: WebResearchReport): void {
    writeGenericArtifact('research/latest_web_research.json', report);
    writeGenericArtifact(`research/history/${report.research_id}.json`, report);
    writeGenericTextArtifact('research/latest_web_research.md', renderWebResearchMarkdown(report));
  }

  readLatestReport(): WebResearchReport | null {
    const path = 'research/latest_web_research.json';
    if (!existsSync(path)) return null;
    try { return readGenericArtifact(path)! as WebResearchReport; } catch { return null; }
  }
}

export function renderWebResearchMarkdown(report: WebResearchReport): string {
  const lines = [
    '# 外部研究线索',
    '',
    `- 状态: ${report.status}`,
    `- 提供方: ${report.provider}`,
    `- 查询数: ${report.queries.length}`,
    `- 线索数: ${report.lead_count}`,
    '',
    '## 检索执行',
    '',
    ...(report.provider_runs?.length
      ? report.provider_runs.map((run) => `- ${run.provider}: 查询 ${run.query_count}，成功 ${run.successful_query_count}，空结果 ${run.zero_result_query_count}，原始结果 ${run.raw_result_count}，有效线索 ${run.normalized_lead_count}，错误 ${run.error_count}`)
      : ['- 此历史报告未记录提供方执行明细。']),
    '',
    '## 来源产出',
    '',
    ...(report.source_yield?.length
      ? report.source_yield.map((item) => `- ${item.source_name}: ${item.lead_count} 条线索`)
      : ['- 暂无通过规范化的来源线索。']),
    '',
    '## 线索',
    '',
    ...(report.leads.length ? report.leads.map((lead) => `- ${lead.title} (${lead.url})`) : ['- 暂无线索。']),
    '',
    '## 边界',
    '',
    '- 检索摘要只用于发现与核对，不能直接进入正式证据表、阶段或评分。',
    '- 需读取原始来源并通过主题、分支、去重与 Evidence Gate 后，才可作为正式证据。',
    '',
  ];
  return `${lines.join('\n')}\n`;
}
