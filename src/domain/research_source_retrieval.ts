import { createHash } from 'node:crypto';
import type { ResearchLeadTriageItem, ResearchLeadTriageReport } from '@/types/research_lead_triage';
import type { ResearchSourceRetrievalItem } from '@/types/research_source_retrieval';

const RETRIEVABLE_CLASSES = new Set(['official', 'company_primary', 'academic']);

export function selectSourceRetrievalTargets(report: ResearchLeadTriageReport | null, limit: number): ResearchLeadTriageItem[] {
  if (!report || limit < 1) return [];
  return report.items
    .filter((item) => ['priority_review', 'review'].includes(item.disposition))
    .filter((item) => RETRIEVABLE_CLASSES.has(item.source_class))
    .slice(0, limit);
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
  return baseItem(input.lead, input.fetchedAt, {
    status: excerpts.length ? 'retrieved' : 'skipped',
    http_status: input.httpStatus,
    content_type: input.contentType,
    page_title: extracted.title,
    excerpts,
    content_hash: extracted.text ? hash(extracted.text) : null,
    error: excerpts.length ? null : 'source_page_has_no_readable_text',
  });
}

export function buildFailedSourceItem(input: { lead: ResearchLeadTriageItem; fetchedAt: string; error: string; httpStatus?: number | null }): ResearchSourceRetrievalItem {
  return baseItem(input.lead, input.fetchedAt, { status: 'failed', http_status: input.httpStatus ?? null, content_type: null, page_title: null, excerpts: [], content_hash: null, error: input.error.slice(0, 280) });
}

function baseItem(lead: ResearchLeadTriageItem, fetchedAt: string, detail: Omit<ResearchSourceRetrievalItem, 'retrieval_id' | 'triage_id' | 'origin_lead_id' | 'topic_id' | 'branch_id' | 'candidate_node_id' | 'source_class' | 'disposition' | 'title' | 'url' | 'fetched_at' | 'evidence_eligibility' | 'next_action'>): ResearchSourceRetrievalItem {
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
    fetched_at: fetchedAt,
    ...detail,
    evidence_eligibility: 'context_only',
    next_action: detail.status === 'retrieved' ? 'prepare_intake' : 'hold',
  };
}

/**
 * Extracts a small, reviewable text package. This intentionally prefers the
 * substantive section of known authoritative sources over page chrome. It is
 * not an evidence classifier and never turns text into a formal Evidence.
 */
export function extractReadableSource(raw: string, contentType: string | null, sourceUrl = ''): { title: string | null; text: string } {
  const body = raw.slice(0, 1_000_000);
  if (isClinicalTrialsUrl(sourceUrl) && /json/i.test(contentType ?? '')) return clinicalTrialsText(body);
  if (/arxiv\.org/i.test(sourceUrl)) {
    const abstract = /<blockquote[^>]*class=["'][^"']*\babstract\b[^"']*["'][^>]*>([\s\S]*?)<\/blockquote>/i.exec(body)?.[1];
    if (abstract) {
      const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? '').trim() || null;
      return { title, text: `摘要\n\n${readableText(abstract).replace(/^abstract\s*:\s*/i, '').slice(0, 12_000)}` };
    }
  }
  if (/sec\.gov\/Archives\/edgar/i.test(sourceUrl)) {
    const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? '').trim() || 'SEC Filing';
    const text = readableText(body).slice(0, 12_000);
    return { title, text: `SEC EDGAR Filing Document\n\n${text}` };
  }
  if (/federalregister\.gov/i.test(sourceUrl)) {
    const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? '').trim() || 'Federal Register Document';
    const text = readableText(body).slice(0, 12_000);
    return { title, text: `Federal Register Official Rule / Notice\n\n${text}` };
  }
  if (/json|xml|text\/plain/i.test(contentType ?? '')) return { title: null, text: readableText(body).slice(0, 12_000) };
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? '').trim() || null;
  const withoutChrome = body
    .replace(/<(?:script|style|noscript|header|nav|footer|aside|form)\b[\s\S]*?<\/(?:script|style|noscript|header|nav|footer|aside|form)>/gi, ' ');
  const main = /<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i.exec(withoutChrome)?.[1] ?? withoutChrome;
  const text = readableText(main).slice(0, 12_000);
  return { title, text };
}

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
  return /(?:skip to main|show glossary|hide glossary|search for terms|clinicaltrials\.gov|all studies|privacy policy|cookie settings|sign in|menu|donate|facebook|linkedin|twitter|免责声明|版权所有|联系我们|隐私政策)/i.test(value);
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
