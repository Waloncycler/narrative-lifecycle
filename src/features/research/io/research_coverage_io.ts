import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { AuthoritativeSourceAtlas, CompanyResearchRegistry, ResearchCampaign, ResearchUniverse } from '@/features/research/types/research_coverage';
import type { DirectSourceResearchReport } from '@/features/research/types/direct_source_research';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';

export class DbResearchCoverageRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  readSourceAtlas(): AuthoritativeSourceAtlas {
    return this.readYaml<AuthoritativeSourceAtlas>('data/source_atlas/authoritative_sources.yaml');
  }

  readUniverse(): ResearchUniverse {
    return this.readYaml<ResearchUniverse>('data/research_universe/core_topics.yaml');
  }

  readCompanyRegistry(): CompanyResearchRegistry {
    return this.readYaml<CompanyResearchRegistry>('data/company_registry/core_companies.yaml');
  }

  writeCampaign(campaign: ResearchCampaign): void {
    writeGenericArtifact('research/latest_campaign.json', campaign);
    writeGenericArtifact(`research/history/${campaign.campaign_id}.json`, campaign);
    writeGenericTextArtifact('research/latest_campaign.md', renderResearchCampaignMarkdown(campaign));
  }

  writeDirectResearch(report: DirectSourceResearchReport): void {
    writeGenericArtifact('research/latest_direct_source_research.json', report);
    writeGenericArtifact(`research/history/${report.research_id}.json`, report);
    writeGenericTextArtifact('research/latest_direct_source_research.md', renderDirectSourceResearchMarkdown(report));
  }

  readLatestDirectResearch(): DirectSourceResearchReport | null {
    const path = 'research/latest_direct_source_research.json';
    return readGenericArtifact<DirectSourceResearchReport>(path);
  }

  private readYaml<T>(relativePath: string): T {
    const path = resolve(this.repoRoot, relativePath);
    const persisted = readGenericArtifact<T>(path);
    if (persisted) return persisted;
    // Static research coverage configuration is bootstrapping data, not a
    // runtime artifact. Keep this narrow fallback so a fresh database can
    // execute a first campaign before its configuration has been persisted.
    if (existsSync(path)) return parse(readFileSync(path, 'utf8')) as T;
    throw new Error(`research coverage configuration missing: ${relativePath}`);
  }
}

export function renderResearchCampaignMarkdown(campaign: ResearchCampaign): string {
  const lines = [
    '# 主题研究覆盖计划',
    '',
    `- 计划编号: ${campaign.campaign_id}`,
    `- 正式主题: ${campaign.summary.formal_topic_count}`,
    `- 暂定主题: ${campaign.summary.provisional_topic_count}`,
    `- 研究种子: ${campaign.summary.universe_seed_count}`,
    `- 有效分支: ${campaign.summary.branch_count}`,
    `- 来源目标: ${campaign.summary.source_target_count}`,
    `- 检索任务: ${campaign.summary.task_count}`,
    '',
    '## 优先任务',
    '',
    ...campaign.tasks.slice(0, 40).map((task) => `- ${task.display_name_zh} [${task.formal_status}]：${task.query}${task.company_targets?.length ? `（公司核验：${task.company_targets.map((company) => company.display_name_zh).join('、')}）` : ''}`),
    '',
    '## 边界',
    '',
    '- 研究种子只是待发现方向，不是正式主题，不继承阶段。',
    '- 来源能力目录不代表已连通；仅已配置的 API、RSS 或 MCP Bridge 会实际检索。',
    '- 搜索结果只是待核验线索，必须经过引用、主题/分支、去重和 Evidence Gate。',
    '- 分支材料单独积累，不能升级整体主题。',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderDirectSourceResearchMarkdown(report: DirectSourceResearchReport): string {
  const lines = [
    '# 权威公开 API 研究线索',
    '',
    `- 状态: ${report.status}`,
    `- 查询: ${report.queries.length}`,
    `- 待核验线索: ${report.lead_count}`,
    '',
    '## 线索',
    '',
    ...report.leads.slice(0, 40).map((lead) => `- [${lead.title}](${lead.url}) (${lead.source_name})`),
    '',
    '## 边界',
    '',
    '- 此文件是原始来源检索线索，不是正式 Evidence。',
    '- 线索必须经人工/Agent 引用核验、Topic Resolver、去重和 Evidence Gate 后才可进入证据表。',
    '- 分支线索保持 branch scope，不能提升父主题。',
    '',
  ];
  return `${lines.join('\n')}\n`;
}
