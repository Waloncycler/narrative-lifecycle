import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { WebResearchReport } from '@/features/research/types/web_research';
import { writeJsonAtomically, writeTextAtomically } from '@/platform/io/run_manifest_writer';

export class FileWebResearchRepository {
  constructor(private readonly repoRoot: string) {}

  writeReport(report: WebResearchReport): void {
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/research/latest_web_research.json'), report);
    writeJsonAtomically(resolve(this.repoRoot, `outputs/research/history/${report.research_id}.json`), report);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/research/latest_web_research.md'), renderWebResearchMarkdown(report));
  }

  readLatestReport(): WebResearchReport | null {
    const path = resolve(this.repoRoot, 'outputs/research/latest_web_research.json');
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, 'utf8')) as WebResearchReport; } catch { return null; }
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
