import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';

export class DbResearchLeadTriageRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  writeReport(report: ResearchLeadTriageReport): void {
    writeGenericArtifact('research/latest_lead_triage.json', report);
    writeGenericArtifact(`research/history/${report.triage_id}.json`, report);
    writeGenericTextArtifact('research/latest_lead_triage.md', renderResearchLeadTriageMarkdown(report));
  }

  readLatestReport(): ResearchLeadTriageReport | null {
    const path = 'research/latest_lead_triage.json';
    if (!existsSync(path)) return null;
    try { return readGenericArtifact(path)! as ResearchLeadTriageReport; } catch { return null; }
  }
}

export function renderResearchLeadTriageMarkdown(report: ResearchLeadTriageReport): string {
  const lines = [
    '# 研究线索分诊队列',
    '',
    `- 输入线索: ${report.input_lead_count}`,
    `- 合并后线索: ${report.triaged_lead_count}`,
    `- 优先核验: ${report.summary.priority_review_count}`,
    `- 常规核验: ${report.summary.review_count}`,
    `- 参考资料: ${report.summary.reference_only_count}`,
    `- 暂缓: ${report.summary.hold_count}`,
    `- 同 scope 重复发现: ${report.summary.duplicate_count}`,
    '',
    '## 优先处理',
    '',
    ...(report.items.length
      ? report.items.slice(0, 40).map((item) => `- [${item.title}](${item.url}) · ${dispositionLabel(item.disposition)} · ${sourceLabel(item.source_class)} · ${item.reasons.join('；')}`)
      : ['- 暂无可分诊线索。']),
    '',
    '## 边界',
    '',
    '- 本报告只组织 context-only 检索线索，不创建正式 Evidence，也不改变 Topic、Branch、Stage、Score 或 Dashboard。',
    '- 同一 URL 在父主题和分支下分别保留；分支发现不能抬升父主题。',
    '- 优先核验不等于可信结论，必须打开原始来源并走现有 Evidence Gate。',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function dispositionLabel(value: string): string {
  return ({ priority_review: '优先核验', review: '常规核验', reference_only: '参考资料', hold: '暂缓', duplicate: '重复' } as Record<string, string>)[value] ?? value;
}

function sourceLabel(value: string): string {
  return ({ official: '权威', company_primary: '公司原始页', academic: '学术', reference: '参考', community: '社区', secondary: '二级来源', unknown: '未识别' } as Record<string, string>)[value] ?? value;
}
