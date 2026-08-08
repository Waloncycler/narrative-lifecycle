import type {
  WorldMonitorNormalizedFact,
  WorldMonitorPayload,
} from '@/features/worldmonitor/types/worldmonitor_adapter';

/**
 * Generic structured-content parsing for feed-style sources (v0.8.1+).
 *
 * The World Monitor adapter used to treat every upstream as a structured
 * JSON/OpenAPI operation. Vendor official blogs (RSS/Atom), government news
 * pages and research portals expose either XML feeds or server-rendered HTML
 * lists. This module provides dependency-free parsers for both formats plus
 * per-source normalizers, so the sync pipeline can turn them into the same
 * low-strength unresolved Evidence candidates as JSON sources.
 *
 * Guardrails inherited from the rest of the pipeline: parsed items are still
 * only "candidates" — Topic/Branch/Stage assignment and import remain
 * human-gated. Empty or malformed pages simply produce zero records.
 */

const FEED_OPERATION_EVENT_TYPES: Record<string, string> = {
  DirectOpenAiBlog: 'OFFICIAL_ANNOUNCEMENT',
  DirectOpenAiApiReleases: 'OFFICIAL_ANNOUNCEMENT',
  DirectDeepMindBlog: 'OFFICIAL_ANNOUNCEMENT',
  DirectAppleNewsroom: 'OFFICIAL_ANNOUNCEMENT',
  DirectMetaNews: 'OFFICIAL_ANNOUNCEMENT',
  DirectAnthropicNews: 'OFFICIAL_ANNOUNCEMENT',
  DirectAnthropicReleases: 'OFFICIAL_ANNOUNCEMENT',
  DirectXaiReleases: 'OFFICIAL_ANNOUNCEMENT',
  DirectMicrosoftAiBlog: 'OFFICIAL_ANNOUNCEMENT',
  DirectArxivPreprints: 'PREPRINT_PUBLISHED',
  DirectBbcTech: 'NEWS_ARTICLE_PUBLISHED',
  DirectVentureBeat: 'NEWS_ARTICLE_PUBLISHED',
  Direct36KrFeed: 'NEWS_ARTICLE_PUBLISHED',
  DirectEconomicTimes: 'NEWS_ARTICLE_PUBLISHED',
  DirectSinaFinance: 'NEWS_ARTICLE_PUBLISHED',
  DirectYicaiNews: 'NEWS_ARTICLE_PUBLISHED',
  DirectCrunchbaseNews: 'NEWS_ARTICLE_PUBLISHED',
  DirectHuggingFaceModels: 'OPEN_SOURCE_MODEL',
  DirectGithubTrending: 'OPEN_SOURCE_REPO',
  DirectGovCnPolicy: 'GOVERNMENT_POLICY_UPDATE',
  DirectNdrcNews: 'OFFICIAL_GOV_ANNOUNCEMENT',
  DirectCsrcNews: 'OFFICIAL_GOV_ANNOUNCEMENT',
  DirectSseAnnouncements: 'OFFICIAL_GOV_ANNOUNCEMENT',
  DirectSzseAnnouncements: 'OFFICIAL_GOV_ANNOUNCEMENT',
  DirectBloombergTech: 'NEWS_ARTICLE_PUBLISHED',
  DirectConcordiaResearch: 'RESEARCH_REPORT_PUBLISHED',
  DirectBrookingsResearch: 'RESEARCH_REPORT_PUBLISHED',
  DirectMorganStanleyInsights: 'RESEARCH_REPORT_PUBLISHED',
  DirectCninfoAnnouncements: 'OFFICIAL_ANNOUNCEMENT',
};

const MEDIA_OPERATIONS = new Set([
  'DirectBbcTech',
  'DirectVentureBeat',
  'Direct36KrFeed',
  'DirectEconomicTimes',
  'DirectSinaFinance',
  'DirectYicaiNews',
  'DirectCrunchbaseNews',
  'DirectBloombergTech',
]);

export const FEED_OPERATION_IDS = Object.keys(FEED_OPERATION_EVENT_TYPES);

const GOV_OPERATIONS = new Set([
  'DirectGovCnPolicy',
  'DirectNdrcNews',
  'DirectCsrcNews',
  'DirectSseAnnouncements',
  'DirectSzseAnnouncements',
]);

// Exchanges report the issuer in the record, so the normalized title is
// enriched with `issuer (code) 公告: ...` (see normalizeFeedSource).
const EXCHANGE_OPERATIONS = new Set([
  'DirectCninfoAnnouncements',
  'DirectSseAnnouncements',
  'DirectSzseAnnouncements',
]);

const RESEARCH_OPERATIONS = new Set([
  'DirectBrookingsResearch',
  'DirectMorganStanleyInsights',
  'DirectConcordiaResearch',
]);

const JSON_OPERATIONS: Record<string, (body: unknown) => Record<string, unknown>[]> = {
  DirectHuggingFaceModels: (body) => objectArray(body),
  DirectGithubTrending: (body) => objectArray(object(body)?.items),
  DirectSinaFinance: (body) => objectArray(object(object(body)?.result)?.data),
  DirectCninfoAnnouncements: (body) => objectArray(object(body)?.announcements),
  // SSE returns pageHelp.data with UPPER_CASE column names; SZSE returns data
  // with array secCode/secName. Both are normalized to lowercase fields so the
  // shared normalizer can enrich titles and resolve the PDF download URLs.
  DirectSseAnnouncements: (body) => objectArray(object(object(body)?.pageHelp)?.data)
    .map((record) => ({
      title: string(record.TITLE),
      secName: string(record.SECURITY_NAME),
      secCode: string(record.SECURITY_CODE),
      date: string(record.ADDDATE),
      url: string(record.URL),
    }) as Record<string, unknown>)
    .filter((record) => Boolean(record.title)),
  DirectSzseAnnouncements: (body) => objectArray(object(body)?.data)
    .map((record) => ({
      title: string(record.title),
      secName: firstArrayString(record.secName),
      secCode: firstArrayString(record.secCode),
      date: string(record.publishTime),
      url: string(record.attachPath),
    }) as Record<string, unknown>)
    .filter((record) => Boolean(record.title)),
};

export function isFeedOperation(operationId: string): boolean {
  return Object.hasOwn(FEED_OPERATION_EVENT_TYPES, operationId);
}

export function feedRecordsForOperation(operationId: string, body: unknown): Record<string, unknown>[] {
  if (typeof body === 'object' && body !== null && typeof (body as { __xml?: unknown }).__xml === 'string') {
    return rssRecords((body as { __xml: string }).__xml);
  }
  if (typeof body === 'object' && body !== null && typeof (body as { __html?: unknown }).__html === 'string') {
    return htmlArticleRecords((body as { __html: string }).__html);
  }
  const jsonRecords = JSON_OPERATIONS[operationId];
  return jsonRecords ? jsonRecords(body) : [];
}

export function normalizeFeedSource(
  operationId: string,
  record: Record<string, unknown>,
  payload: WorldMonitorPayload,
): WorldMonitorNormalizedFact | null {
  const title = firstString(record, ['title', 'name', 'full_name', 'announcementTitle', 'id']);
  if (!title) return null;
  const eventType = FEED_OPERATION_EVENT_TYPES[operationId] ?? 'FEED_SIGNAL';
  const eventAt = iso(record.date ?? record.pubDate ?? record.updated ?? record.published ?? record.ctime ?? record.announcementTime, payload.fetched_at);
  const sourceUrl = resolveSourceUrl(operationId, record, payload.source_url);
  const displayTitle = EXCHANGE_OPERATIONS.has(operationId)
    ? `${string(record.secName) ?? ''}${string(record.secCode) ? ` (${string(record.secCode)})` : ''}${string(record.secName) || string(record.secCode) ? ' 公告: ' : ''}${title}`
    : title;
  const summary = buildSummary(operationId, title, record, eventAt, payload);
  const sourceQuote = boundedJson(record);
  const location = GOV_OPERATIONS.has(operationId)
    ? { country: 'China' }
    : undefined;
  const metrics = metricsFor(operationId, record);
  const id = upstreamId(operationId, record, sourceUrl);
  return {
    upstream_record_id: id,
    event_at: eventAt,
    available_at: eventAt,
    title: displayTitle.slice(0, 240),
    summary,
    event_type: eventType,
    source_url: sourceUrl,
    source_quote: sourceQuote,
    ...(location ? { location } : {}),
    ...(metrics ? { metrics } : {}),
    raw_record: record,
    normalizer_id: normalizerIdForFeedOperation(operationId),
    normalizer_version: '1.0.0',
  };
}

export function normalizerIdForFeedOperation(operationId: string): string {
  const ids: Record<string, string> = {
    DirectOpenAiBlog: 'openai_blog_announcement',
    DirectOpenAiApiReleases: 'openai_api_release',
    DirectDeepMindBlog: 'deepmind_blog_announcement',
    DirectAppleNewsroom: 'apple_newsroom_announcement',
    DirectMetaNews: 'meta_news_announcement',
    DirectAnthropicNews: 'anthropic_news_announcement',
    DirectAnthropicReleases: 'anthropic_release',
    DirectXaiReleases: 'xai_release',
    DirectMicrosoftAiBlog: 'microsoft_ai_blog_announcement',
    DirectArxivPreprints: 'arxiv_preprint',
    DirectBbcTech: 'news_article',
    DirectVentureBeat: 'news_article',
    Direct36KrFeed: 'news_article',
    DirectEconomicTimes: 'news_article',
    DirectSinaFinance: 'news_article',
    DirectYicaiNews: 'news_article',
    DirectCrunchbaseNews: 'news_article',
    DirectHuggingFaceModels: 'huggingface_model',
    DirectGithubTrending: 'github_repo_signal',
    DirectGovCnPolicy: 'govcn_policy_update',
    DirectNdrcNews: 'gov_announcement',
    DirectCsrcNews: 'regulator_announcement',
    DirectSseAnnouncements: 'exchange_announcement',
    DirectSzseAnnouncements: 'exchange_announcement',
    DirectBloombergTech: 'news_article',
    DirectConcordiaResearch: 'research_report',
    DirectBrookingsResearch: 'research_report',
    DirectMorganStanleyInsights: 'research_report',
    DirectCninfoAnnouncements: 'cninfo_announcement',
  };
  return ids[operationId] ?? 'feed_signal';
}

/**
 * Parses RSS 2.0 and Atom feeds into item records. Kept dependency-free with
 * regex block extraction: RSS <item> elements and Atom <entry> elements are
 * both supported, and CDATA/entity-encoded content is decoded.
 */
export function rssRecords(xml: string): Record<string, unknown>[] {
  if (!xml || xml.length > 5_000_000) return [];
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)]
    .map((match) => match[0])
    .slice(0, 60);
  return blocks
    .map((block) => rssRecordFromBlock(block))
    .filter((record): record is Record<string, unknown> => Boolean(record && string(record.title)));
}

function rssRecordFromBlock(block: string): Record<string, unknown> | null {
  const title = decode(innerText(block, 'title'));
  if (!title) return null;
  const link = linkFrom(block);
  const id = decode(innerText(block, 'guid') ?? innerText(block, 'id'));
  const description = decode(innerText(block, 'content:encoded') ?? innerText(block, 'description') ?? innerText(block, 'summary'));
  const author = decode(innerText(block, 'dc:creator') ?? innerText(block, 'author') ?? innerText(block, 'name'));
  const date = firstText(block, ['pubDate', 'updated', 'published', 'dc:date']);
  return {
    title,
    link,
    id: id ?? link,
    description: stripTags(description),
    author,
    date,
  };
}

function linkFrom(block: string): string | null {
  const href = /<link[^>]*href="([^"]+)"/i.exec(block);
  if (href?.[1]) return safeDecodeURI(decode(href[1]) ?? '');
  const content = /<link\b[^>]*>([\s\S]*?)<\/link>/i.exec(block);
  return content?.[1] ? decode(content[1]) : null;
}

function safeDecodeURI(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

/**
 * Extracts article-like anchors from server-rendered HTML listing pages.
 * Prefers anchors whose href looks like an article URL or whose surrounding
 * text contains a date, which filters out navigation chrome on gov/media sites.
 */
export function htmlArticleRecords(html: string): Record<string, unknown>[] {
  if (!html || html.length > 5_000_000) return [];
  const cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const candidates: Array<{ href: string; title: string; date: string | null; score: number }> = [];
  for (const match of cleaned.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = safeDecodeURI(decode(match[1]) ?? '').trim();
    const title = collapseWhitespace(stripTags(decode(match[2])));
    if (!acceptableHref(href) || !acceptableTitle(title)) continue;
    const index = match.index ?? 0;
    const windowStart = Math.max(0, index - 220);
    const windowEnd = Math.min(cleaned.length, index + match[0].length + 80);
    const context = cleaned.slice(windowStart, windowEnd);
    const nearbyDate = dateFromText(context) ?? dateFromHref(href);
    let score = 0;
    if (nearbyDate) score += 1;
    if (/\/content[.\/]|article|news\/\d+|ideas\/|research\/|zhengce\/|wzsy|xwfb/.test(href)) score += 2;
    if (/^https?:/.test(href)) score += 1;
    if (score === 0) continue;
    candidates.push({ href, title, date: nearbyDate, score });
  }
  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .filter((item) => {
      const key = item.href;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({ href: item.href, title: item.title, date: item.date }));
}

const NAV_TITLES = new Set([
  '首页', 'English', '机构概况', '政务信息', '办事服务', '新闻发布', '互动交流', '网站无障碍开关', '个人中心',
  '国务院公报', '全国人大', '全国政协', '高级搜索', '登录', '注册', '更多', 'more', 'menu', 'Home', 'Skip to content',
]);

function acceptableTitle(title: string): boolean {
  if (title.length < 6 || title.length > 160) return false;
  if (NAV_TITLES.has(title)) return false;
  if (/^(javascript|function|var |window\.|document\.)/i.test(title)) return false;
  return true;
}

function acceptableHref(href: string): boolean {
  if (!href || /^(javascript:|#|mailto:|tel:|void\(0\))/i.test(href)) return false;
  if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|mp4|pdf)$/i.test(href)) return false;
  return true;
}

function dateFromText(text: string): string | null {
  const chinese = /(20\d{2})年(\d{1,2})月(\d{1,2})日/.exec(text);
  if (chinese) return isoDate(chinese[1], chinese[2], chinese[3]);
  const dashed = /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (dashed) return isoDate(dashed[1], dashed[2], dashed[3]);
  const rfc = /([A-Z][a-z]{2},\s*\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4})/.exec(text);
  if (rfc?.[1]) {
    const date = new Date(rfc[1]);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  return null;
}

function dateFromHref(href: string): string | null {
  const compact = /\/t?(20\d{2})(\d{2})(\d{2})[_./]/.exec(href);
  if (compact) return isoDate(compact[1], compact[2], compact[3]);
  const generic = /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(href);
  return generic ? isoDate(generic[1], generic[2], generic[3]) : null;
}

function isoDate(year: string, month: string, day: string): string | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!(y >= 2000 && y <= 2100) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

function resolveSourceUrl(operationId: string, record: Record<string, unknown>, base: string): string {
  if (operationId === 'DirectCninfoAnnouncements' && typeof record.adjunctUrl === 'string') {
    return `https://static.cninfo.com.cn${record.adjunctUrl}`;
  }
  if (operationId === 'DirectSseAnnouncements' && typeof record.url === 'string') {
    return `http://static.sse.com.cn${record.url}`;
  }
  if (operationId === 'DirectSzseAnnouncements' && typeof record.url === 'string') {
    return `http://disc.static.szse.cn${record.url}`;
  }
  if (operationId === 'DirectHuggingFaceModels' && typeof record.id === 'string') {
    return `https://huggingface.co/${record.id}`;
  }
  const explicit = firstString(record, ['html_url', 'link', 'url', 'href']);
  if (!explicit) return base;
  if (/^https?:\/\//i.test(explicit)) return explicit;
  try {
    return new URL(explicit, base).toString();
  } catch {
    return base;
  }
}

function upstreamId(operationId: string, record: Record<string, unknown>, sourceUrl: string): string | null {
  const explicit = firstString(record, ['id', 'guid', 'html_url', 'link', 'url', 'href', 'secCode']);
  if (explicit) return explicit;
  if (sourceUrl) return sourceUrl;
  return null;
}

function buildSummary(
  operationId: string,
  title: string,
  record: Record<string, unknown>,
  eventAt: string,
  payload: WorldMonitorPayload,
): string {
  const description = firstString(record, ['description', 'summary', 'intro']);
  if (MEDIA_OPERATIONS.has(operationId)) {
    return sentence([`新闻动态 ${eventAt.slice(0, 10)}`, description ?? null, `来源 ${payload.source_url}`]);
  }
  if (operationId === 'DirectArxivPreprints') {
    return sentence([`arXiv 预印本发布于 ${eventAt.slice(0, 10)}`, description ?? null, string(record.author) ? `作者 ${string(record.author)}` : null]);
  }
  if (operationId === 'DirectHuggingFaceModels') {
    return sentence([`Hugging Face 开源模型`, description ?? null, `下载 ${number(record.downloads) ?? '未知'}`]);
  }
  if (operationId === 'DirectGithubTrending') {
    return sentence([`GitHub 开源仓库`, description ?? null, `Stars ${number(record.stargazers_count) ?? '未知'}`]);
  }
  if (GOV_OPERATIONS.has(operationId)) {
    return sentence([`中国政府官方公告 ${eventAt.slice(0, 10)}`, description ?? null, `原始来源 ${payload.source_url}`]);
  }
  if (RESEARCH_OPERATIONS.has(operationId)) {
    return sentence([`研究报告发布于 ${eventAt.slice(0, 10)}`, description ?? null, `来源 ${payload.source_url}`]);
  }
  return sentence([`官方发布 ${eventAt.slice(0, 10)}`, description ?? null, `原始来源 ${payload.source_url}`]);
}

function metricsFor(operationId: string, record: Record<string, unknown>): Record<string, number> | undefined {
  if (operationId === 'DirectHuggingFaceModels') {
    return numericRecord({ downloads: number(record.downloads), likes: number(record.likes) });
  }
  if (operationId === 'DirectGithubTrending') {
    return numericRecord({
      stars: number(record.stargazers_count),
      forks: number(record.forks_count),
      open_issues: number(record.open_issues_count),
    });
  }
  if (operationId === 'DirectArxivPreprints') {
    return undefined;
  }
  return undefined;
}

function innerText(block: string, tag: string): string | null {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i').exec(block);
  return match?.[1] ?? null;
}

function firstText(block: string, tags: string[]): string | null {
  for (const tag of tags) {
    const value = innerText(block, tag);
    if (value) return value;
  }
  return null;
}

function decode(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^<!\[CDATA\[|\]\]>$/g, '');
  return trimmed
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(value: string | null): string {
  return value ? collapseWhitespace(value.replace(/<[^>]+>/g, ' ')) : '';
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = string(record[key]);
    if (value) return value;
  }
  return null;
}

function firstArrayString(value: unknown): string | null {
  if (Array.isArray(value)) return string(value.find((item) => typeof item === 'string'));
  return string(value);
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : null;
}

function number(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function object(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

function iso(value: unknown, fallback: string): string {
  const date = typeof value === 'number'
    ? new Date(value > 1e12 ? value : value * 1000)
    : typeof value === 'string'
      ? new Date(value)
      : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
}

function numericRecord(values: Record<string, number | null>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, number] => entry[1] !== null));
}

function sentence(parts: Array<string | null>): string {
  const value = parts.filter((part): part is string => Boolean(part)).join('; ');
  return value ? `${value.replace(/[.;]\s*$/, '')}.` : '';
}

function boundedJson(value: Record<string, unknown>): string {
  const json = JSON.stringify(value);
  return json.length <= 1600 ? json : `${json.slice(0, 1597)}...`;
}
