import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';
import type { ResearchSourceQualityReport } from '@/features/research/types/research_source_quality';
import { writeJsonAtomically, writeTextAtomically } from '@/platform/io/run_manifest_writer';

export class FileResearchSourceRetrievalRepository {
  constructor(private readonly repoRoot: string) {}
  writeReport(report: ResearchSourceRetrievalReport): void {
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/research/latest_source_retrieval.json'), report);
    writeJsonAtomically(resolve(this.repoRoot, `outputs/research/history/${report.retrieval_run_id}.json`), report);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/research/latest_source_retrieval.md'), renderResearchSourceRetrievalMarkdown(report));
  }
  readLatestReport(): ResearchSourceRetrievalReport | null {
    const path = resolve(this.repoRoot, 'outputs/research/latest_source_retrieval.json');
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, 'utf8')) as ResearchSourceRetrievalReport; } catch { return null; }
  }
  writeQualityReport(report: ResearchSourceQualityReport): void {
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/research/latest_source_quality.json'), report);
    writeJsonAtomically(resolve(this.repoRoot, `outputs/research/history/${report.retrieval_run_id}_quality.json`), report);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/research/latest_source_quality.md'), renderResearchSourceQualityMarkdown(report));
  }
}

export class HttpResearchSourceRetriever {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}
  async retrieve(input: { url: string; timeoutMs: number }): Promise<{ httpStatus: number; contentType: string | null; body: string }> {
    assertPublicHttpUrl(input.url);
    const studyId = /clinicaltrials\.gov\/study\/(NCT\d+)/i.exec(input.url)?.[1];
    // The public study page is an application shell. For this governed source,
    // use its documented public record endpoint while retaining the original
    // study URL in the retrieval artifact.
    const requestUrl = studyId ? `https://clinicaltrials.gov/api/v2/studies/${studyId}` : input.url;
    assertPublicHttpUrl(requestUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const response = await this.fetchImpl(requestUrl, { headers: { Accept: 'text/html,application/xhtml+xml,application/xml,text/plain,application/json', 'User-Agent': 'NarrativeLifecycleResearch/0.13' }, redirect: 'follow', signal: controller.signal });
      assertPublicHttpUrl(response.url || requestUrl);
      if (!response.ok) throw new Error(`http_${response.status}`);
      const contentType = response.headers.get('content-type');
      if (/(?:application\/pdf|image\/|video\/|audio\/)/i.test(contentType ?? '')) throw new Error('unsupported_binary_source_content');
      return { httpStatus: response.status, contentType, body: (await response.text()).slice(0, 1_000_000) };
    } finally { clearTimeout(timer); }
  }
}

function assertPublicHttpUrl(value: string): void {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported_source_url_protocol');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || /^127\.|^0\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || host === '::1') throw new Error('unsafe_source_url_host');
}

function renderResearchSourceRetrievalMarkdown(report: ResearchSourceRetrievalReport): string {
  const lines = ['# 原始页面取证包', '', `- 请求: ${report.requested_count}`, `- 已取得正文: ${report.retrieved_count}`, `- 无可读正文: ${report.skipped_count}`, `- 失败: ${report.failed_count}`, '', '## 可复核摘录', '', ...report.items.filter((item) => item.status === 'retrieved').flatMap((item) => [`- [${item.title}](${item.url}) · ${item.extractor_id ?? 'generic_html'} · 引用${item.citation_status === 'ready' ? '可进入审核' : '待补全'}`, ...item.excerpts.map((excerpt) => `  - ${excerpt.location_label}: ${excerpt.quote}`), ...(item.citation_notes?.map((note) => `  - 待补全：${note}`) ?? [])]), '', '## 边界', '', '- 仅保存有限正文摘录与内容指纹，不把网页全文或标题自动转成 Evidence。', '- 每一条摘录仍需经 Intake、Topic/Branch、去重、Evidence Gate 和人工复核。', '- 分支摘录保持独立 scope，不能升级父主题。', ''];
  return `${lines.join('\n')}\n`;
}

function renderResearchSourceQualityMarkdown(report: ResearchSourceQualityReport): string {
  const rate = (value: number | string) => typeof value === 'number' ? `${Math.round(value * 100)}%` : '数据不足';
  const lines = [
    '# 来源取证质量报告',
    '',
    `- 取证运行: ${report.retrieval_run_id}`,
    `- 引用可进入审核: ${report.citation_ready_count}/${report.retrieved_count} (${rate(report.citation_ready_rate)})`,
    `- 引用位置完整: ${rate(report.quote_integrity_rate)}`,
    `- 平均可读正文: ${report.average_source_text_chars === 'insufficient_data' ? '数据不足' : report.average_source_text_chars} 字符`,
    '',
    '## 提取器覆盖',
    '',
    ...(Object.entries(report.extractor_counts).map(([id, count]) => `- ${id}: ${count}`) || ['- 本次没有可评估的正文。']),
    '',
    '## 需人工评估',
    '',
    '- 事实支持度: pending_human_review',
    '- Topic/Branch 准确率: pending_human_review',
    '- 质量指标不创建 Evidence，也不改变 Stage 或 Score。',
    '',
  ];
  return `${lines.join('\n')}\n`;
}
