import { createHash } from 'node:crypto';
import type { ResearchLeadTriageItem, ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';
import type { ResearchSourceExtractorId, ResearchSourceRetrievalItem, SourcePageExcerpt } from '@/features/research/types/research_source_retrieval';

const RETRIEVABLE_CLASSES = new Set(['official', 'company_primary', 'academic']);

export function selectSourceRetrievalTargets(report: ResearchLeadTriageReport | null, limit: number): ResearchLeadTriageItem[] {
  if (!report || limit < 1) return [];
  return report.items
    .filter((item) => ['priority_review', 'review'].includes(item.disposition))
    .filter((item) => RETRIEVABLE_CLASSES.has(item.source_class))
    // Daily discovery must spend its bounded retrieval budget on fresh
    // material first. Archive items remain available when the queue has no
    // fresh/recent authority records and are handled explicitly by the
    // separate historical-provenance workflow.
    .sort((left, right) => freshnessWeight(right.freshness) - freshnessWeight(left.freshness)
      || priorityScore(right) - priorityScore(left)
      || left.triage_id.localeCompare(right.triage_id))
    .slice(0, limit);
}

function freshnessWeight(value: ResearchLeadTriageItem['freshness']): number {
  return value === 'fresh' ? 3 : value === 'recent' ? 2 : value === 'undated' ? 1 : 0;
}

function priorityScore(value: ResearchLeadTriageItem): number {
  return Number.isFinite(value.priority_score) ? value.priority_score : 0;
}

export function buildRetrievedSourceItem(input: {
  lead: ResearchLeadTriageItem;
  fetchedAt: string;
  httpStatus: number;
  contentType: string | null;
  body: string;
}): ResearchSourceRetrievalItem {
  const extracted = extractReadableSource(input.body, input.contentType, input.lead.url);
  const excerpts = excerptsFrom(extracted.text);
  const citation = assessCitationReadiness(extracted.text, excerpts);
  return baseItem(input.lead, input.fetchedAt, {
    status: citation.status === 'ready' ? 'retrieved' : 'skipped',
    http_status: input.httpStatus,
    content_type: input.contentType,
    page_title: extracted.title,
    extractor_id: extracted.extractor_id,
    excerpts,
    citation_status: citation.status,
    citation_notes: citation.notes,
    source_text_chars: extracted.text.length,
    content_hash: extracted.text ? hash(extracted.text) : null,
    error: citation.status === 'ready' ? null : 'source_page_not_citation_ready',
  });
}

export function buildFailedSourceItem(input: { lead: ResearchLeadTriageItem; fetchedAt: string; error: string; httpStatus?: number | null }): ResearchSourceRetrievalItem {
  return baseItem(input.lead, input.fetchedAt, { status: 'failed', http_status: input.httpStatus ?? null, content_type: null, page_title: null, extractor_id: 'generic_html', excerpts: [], citation_status: 'insufficient', citation_notes: ['原始页面未能取得可复核正文。'], source_text_chars: 0, content_hash: null, error: input.error.slice(0, 280) });
}

function baseItem(lead: ResearchLeadTriageItem, fetchedAt: string, detail: Omit<ResearchSourceRetrievalItem, 'retrieval_id' | 'triage_id' | 'origin_lead_id' | 'topic_id' | 'branch_id' | 'candidate_node_id' | 'source_class' | 'disposition' | 'title' | 'url' | 'source_published_at' | 'fetched_at' | 'evidence_eligibility' | 'next_action'>): ResearchSourceRetrievalItem {
  return {
    retrieval_id: `source_page_${hash(`${lead.triage_id}|${lead.url}`)}`,
    triage_id: lead.triage_id,
    origin_lead_id: lead.origin_lead_id,
    topic_id: lead.topic_id,
    branch_id: lead.branch_id,
    candidate_node_id: lead.candidate_node_id,
    source_class: lead.source_class,
    disposition: lead.disposition,
    title: lead.title,
    url: lead.url,
    source_published_at: lead.published_at,
    fetched_at: fetchedAt,
    ...detail,
    evidence_eligibility: 'context_only',
    next_action: detail.status === 'retrieved' && detail.citation_status === 'ready' ? 'prepare_intake' : 'hold',
  };
}

/**
 * Extracts a small, reviewable text package. This intentionally prefers the
 * substantive section of known authoritative sources over page chrome. It is
 * not an evidence classifier and never turns text into a formal Evidence.
 */
export function extractReadableSource(raw: string, contentType: string | null, sourceUrl = ''): { title: string | null; text: string; extractor_id: ResearchSourceExtractorId } {
  const body = raw.slice(0, 1_000_000);
  if (isClinicalTrialsUrl(sourceUrl) && /json/i.test(contentType ?? '')) return { ...clinicalTrialsText(body), extractor_id: 'clinicaltrials_api' };
  if (/arxiv\.org/i.test(sourceUrl)) {
    const abstract = /<blockquote[^>]*class=["'][^"']*\babstract\b[^"']*["'][^>]*>([\s\S]*?)<\/blockquote>/i.exec(body)?.[1];
    if (abstract) {
      const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? '').trim() || null;
      return { title, text: `摘要\n\n${readableText(abstract).replace(/^abstract\s*:\s*/i, '').slice(0, 12_000)}`, extractor_id: 'arxiv_abstract' };
    }
  }
  if (/sec\.gov\/Archives\/edgar/i.test(sourceUrl)) {
    const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? '').trim() || 'SEC Filing';
    const text = readableText(body).slice(0, 12_000);
    return { title, text: `SEC EDGAR Filing Document\n\n${text}`, extractor_id: 'sec_edgar_filing' };
  }
  if (/federalregister\.gov/i.test(sourceUrl)) {
    const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? '').trim() || 'Federal Register Document';
    const text = readableText(body).slice(0, 12_000);
    return { title, text: `Federal Register Official Rule / Notice\n\n${text}`, extractor_id: 'federal_register' };
  }
  if (isGovCnUrl(sourceUrl)) {
    const article = firstElement(body, /<(?:div|section)[^>]*(?:class|id)=["'][^"']*(?:TRS_Editor|pages_content|content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
    const title = htmlTitle(body);
    if (article) return { title, text: `国务院及部委正文\n\n${readableText(article).slice(0, 12_000)}`, extractor_id: 'gov_cn_article' };
  }
  if (isPubMedUrl(sourceUrl)) {
    const title = htmlTitle(body);
    const abstract = firstElement(body, /<(?:div|section)[^>]*class=["'][^"']*abstract-content[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i)
      ?? firstElement(body, /<div[^>]*id=["']enc-abstract["'][^>]*>([\s\S]*?)<\/div>/i);
    if (abstract) return { title, text: `论文摘要\n\n${readableText(abstract).slice(0, 12_000)}`, extractor_id: 'pubmed_abstract' };
  }
  if (isPmcUrl(sourceUrl)) {
    const title = htmlTitle(body);
    const article = firstElement(body, /<(?:article|div)[^>]*(?:class|id)=["'][^"']*(?:article-body|main-content|pmc-article)[^"']*["'][^>]*>([\s\S]*?)<\/(?:article|div)>/i)
      ?? firstElement(body, /<body[^>]*>([\s\S]*?)<\/body>/i);
    if (article) return { title, text: `PMC 全文节选\n\n${readableText(article).slice(0, 12_000)}`, extractor_id: 'pmc_jats_article' };
  }
  if (/json/i.test(contentType ?? '')) return { ...structuredJsonText(body), extractor_id: 'structured_json_record' };
  if (/xml|text\/plain/i.test(contentType ?? '')) return { title: null, text: readableText(body).slice(0, 12_000), extractor_id: 'structured_json_record' };
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? '').trim() || null;
  const withoutChrome = body
    .replace(/<(?:script|style|noscript|header|nav|footer|aside|form)\b[\s\S]*?<\/(?:script|style|noscript|header|nav|footer|aside|form)>/gi, ' ');
  // JSON-LD is normally page chrome for rendering, but a company-authored
  // articleBody is a structured primary-text field and must be inspected
  // before scripts are stripped from the generic HTML path.
  const companyArticle = companyArticleBody(body);
  const main = companyArticle ?? /<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i.exec(withoutChrome)?.[1] ?? withoutChrome;
  const text = readableText(main).slice(0, 12_000);
  return { title, text, extractor_id: companyArticle ? 'company_article' : 'generic_html' };
}

function structuredJsonText(raw: string): { title: string | null; text: string } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const record = (parsed.message && typeof parsed.message === 'object' ? parsed.message : parsed) as Record<string, unknown>;
    const title = firstText(record.title) ?? firstText(record.name) ?? firstText(record.headline);
    const parts = [
      title,
      firstText(record.abstract),
      firstText(record.summary),
      firstText(record.description),
      firstText(record.content),
    ].filter((value): value is string => Boolean(value));
    return { title: title ?? null, text: parts.map((part) => readableText(part)).join('\n\n').slice(0, 12_000) };
  } catch {
    return { title: null, text: '' };
  }
}

function companyArticleBody(html: string): string | null {
  const jsonLd = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  if (jsonLd) {
    try {
      const parsed = JSON.parse(jsonLd) as Record<string, unknown> | Array<Record<string, unknown>>;
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const body = records.map((record) => firstText(record.articleBody)).find((value) => (value?.length ?? 0) >= 240);
      if (body) return body;
    } catch {
      // Fall through to semantic HTML.
    }
  }
  return firstElement(html, /<article\b[^>]*>([\s\S]*?)<\/article>/i);
}

function firstText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) return value.find((item): item is string => typeof item === 'string' && Boolean(item.trim()))?.trim() ?? null;
  return null;
}

function firstElement(value: string, pattern: RegExp): string | null { return pattern.exec(value)?.[1] ?? null; }
function htmlTitle(value: string): string | null { return decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(value)?.[1] ?? '').trim() || null; }
function isGovCnUrl(value: string): boolean { return /(?:^|\.)gov\.cn\//i.test(value); }
function isPubMedUrl(value: string): boolean { return /pubmed\.ncbi\.nlm\.nih\.gov/i.test(value); }
function isPmcUrl(value: string): boolean { return /pmc\.ncbi\.nlm\.nih\.gov/i.test(value); }

function excerptsFrom(text: string): ResearchSourceRetrievalItem['excerpts'] {
  const candidates = text
    .split(/\n{2,}|(?<=[。！？；.!?])\s*(?=[A-Z\u4e00-\u9fff【《])/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 60)
    .filter((item) => !isPageChrome(item));
  const selected = candidates
    .map((quote, index) => ({ quote, index, score: excerptScore(quote) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 3)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.quote);
  return selected.map((quote, index) => {
    const start = text.indexOf(quote);
    return { quote: quote.slice(0, 700), quote_start_offset: start, quote_end_offset: start + Math.min(quote.length, 700), location_label: `可引用正文 ${index + 1}` };
  });
}

function assessCitationReadiness(text: string, excerpts: SourcePageExcerpt[]): { status: 'ready' | 'insufficient'; notes: string[] } {
  const notes: string[] = [];
  if (/(?:captcha|radware bot manager|cloudflare|access denied|unusual traffic|验证您是人类|安全验证)/i.test(text)) notes.push('页面为验证码、拦截或访问控制页，不是可引用原文。');
  if (text.length < 240) notes.push('可读正文过短，无法支持事实级复核。');
  if (!excerpts.length) notes.push('未提取到可引用的事实段落。');
  if (excerpts.length && !excerpts.some((item) => item.quote.length >= 120)) notes.push('引用段落过短，需要补充包含事实与限定条件的原文。');
  if (excerpts.some((item) => item.quote_start_offset < 0 || item.quote_end_offset <= item.quote_start_offset)) notes.push('引用位置不完整，不能进入 Evidence 审核。');
  return { status: notes.length ? 'insufficient' : 'ready', notes };
}

function clinicalTrialsText(raw: string): { title: string | null; text: string } {
  try {
    const study = JSON.parse(raw) as Record<string, any>;
    const protocol = study.protocolSection ?? {};
    const identification = protocol.identificationModule ?? {};
    const status = protocol.statusModule ?? {};
    const description = protocol.descriptionModule ?? {};
    const conditions = protocol.conditionsModule ?? {};
    const outcomes = protocol.outcomesModule ?? {};
    const title = String(identification.officialTitle ?? identification.briefTitle ?? '').trim() || null;
    const lines = [
      title ? `试验标题：${title}` : '',
      status.overallStatus ? `试验状态：${status.overallStatus}` : '',
      Array.isArray(conditions.conditions) && conditions.conditions.length ? `适应症：${conditions.conditions.join('；')}` : '',
      description.briefSummary ? `研究概述：${description.briefSummary}` : '',
      description.detailedDescription ? `详细说明：${description.detailedDescription}` : '',
      Array.isArray(outcomes.primaryOutcomes) && outcomes.primaryOutcomes.length
        ? `主要终点：${outcomes.primaryOutcomes.map((item: Record<string, unknown>) => String(item.measure ?? '')).filter(Boolean).join('；')}`
        : '',
      status.lastUpdatePostDateStruct?.date ? `最近更新：${status.lastUpdatePostDateStruct.date}` : '',
    ].filter(Boolean);
    return { title, text: lines.join('\n\n').slice(0, 12_000) };
  } catch {
    return { title: null, text: '' };
  }
}

function readableText(value: string): string {
  return decodeEntities(value)
    .replace(/<(?:br|\/p|\/div|\/li|\/section|\/h[1-6]|\/blockquote|\/tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\r]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isPageChrome(value: string): boolean {
  return /(?:skip to main|show glossary|hide glossary|search for terms|clinicaltrials\.gov|all studies|privacy policy|cookie settings|sign in|menu|donate|facebook|linkedin|twitter|免责声明|版权所有|联系我们|隐私政策|captcha|radware bot manager|cloudflare|access denied|unusual traffic|验证您是人类|安全验证)/i.test(value);
}

function excerptScore(value: string): number {
  let score = Math.min(value.length, 700) / 100;
  if (/(?:摘要|abstract|研究概述|详细说明|主要终点|试验状态|公告|决议|报告|批复|核准|批准|注册|results?|conclusion|methods?|findings?|outcome|approval|approved|announced|reported)/i.test(value)) score += 8;
  if (/\d/.test(value)) score += 1;
  return score;
}

function isClinicalTrialsUrl(value: string): boolean { return /clinicaltrials\.gov\/study\/NCT\d+/i.test(value); }
function decodeEntities(value: string): string { return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'"); }
function hash(value: string): string { return createHash('sha256').update(value).digest('hex').slice(0, 16); }
