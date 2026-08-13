import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parse } from 'yaml';
import type { ResearchPack, ResearchPackRetrievalReport } from '@/features/research/types/research_pack';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';

export class DbResearchPackRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  readPack(file: string): ResearchPack {
    const path = resolve(this.repoRoot, file);
    if (relative(this.repoRoot, path).startsWith('..') || !existsSync(path)) throw new Error(`research pack not found: ${file}`);
    return readGenericArtifact(path)! as ResearchPack;
  }

  writeReport(report: ResearchPackRetrievalReport): void {
    const root = 'research/packs';
    writeGenericArtifact(resolve(root, 'latest_research_pack_retrieval.json'), report);
    writeGenericArtifact(resolve(root, 'history', `${report.pack_id}_${report.generated_at.replace(/[-:.TZ]/g, '').slice(0, 17)}.json`), report);
    writeGenericTextArtifact(resolve(root, 'latest_research_pack_retrieval.md'), renderResearchPackMarkdown(report));
  }
}

function renderResearchPackMarkdown(report: ResearchPackRetrievalReport): string {
  const ready = report.retrieval.items.filter((item) => item.citation_status === 'ready').length;
  return `# 研究包原文取证\n\n- 研究包: ${report.title}\n- 来源目标: ${report.triage.triaged_lead_count}\n- 已取得正文: ${report.retrieval.retrieved_count}\n- 可进入 Intake 审核: ${ready}\n- 失败: ${report.retrieval.failed_count}\n\n## 研究问题\n\n${report.research_questions.map((question) => `- ${question}`).join('\n')}\n\n## 待核验来源\n\n${report.retrieval.items.map((item) => `- [${item.page_title ?? item.title}](${item.url}) · ${item.branch_id ? `分支 ${item.branch_id}` : item.topic_id ?? item.candidate_node_id ?? '待解析 scope'} · ${item.citation_status === 'ready' ? '引用可进入审核' : '引用待补全'}`).join('\n')}\n\n## 边界\n\n- 研究包只是可复现的检索输入；它不注册提议的主题或分支。\n- 原文摘录仍为 context-only，必须经 Topic Resolver、去重和 Evidence Gate。\n- 任何分支材料保持独立 scope，不能抬升父主题阶段。\n- 不产生交易建议。\n`;
}
