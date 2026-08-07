import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ResearchSourceRetrievalReport } from '../types/research_source_retrieval';
import { writeJsonAtomically, writeTextAtomically } from '../services/run_manifest_writer';

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
  const lines = ['# 原始页面取证包', '', `- 请求: ${report.requested_count}`, `- 已取得正文: ${report.retrieved_count}`, `- 无可读正文: ${report.skipped_count}`, `- 失败: ${report.failed_count}`, '', '## 可复核摘录', '', ...report.items.filter((item) => item.status === 'retrieved').flatMap((item) => [`- [${item.title}](${item.url})`, ...item.excerpts.map((excerpt) => `  - ${excerpt.location_label}: ${excerpt.quote}`)]), '', '## 边界', '', '- 仅保存有限正文摘录与内容指纹，不把网页全文或标题自动转成 Evidence。', '- 每一条摘录仍需经 Intake、Topic/Branch、去重、Evidence Gate 和人工复核。', '- 分支摘录保持独立 scope，不能升级父主题。', ''];
  return `${lines.join('\n')}\n`;
}
