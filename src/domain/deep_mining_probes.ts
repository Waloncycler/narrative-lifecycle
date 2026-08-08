import type { ResearchLeadTriageItem } from '@/types/research_lead_triage';
import type { ResearchSourceRetrievalItem, SourcePageExcerpt } from '@/types/research_source_retrieval';
import { extractReadableSource } from './research_source_retrieval';
import { createHash } from 'node:crypto';

export interface DeepMiningProbeInput {
  lead: ResearchLeadTriageItem;
  rawBody: string;
  contentType: string | null;
  fetchedAt: string;
  httpStatus?: number;
}

export interface DeepMiningProbeResult {
  retrievalItem: ResearchSourceRetrievalItem;
  probe_metadata: {
    probe_id: string;
    source_class: ResearchLeadTriageItem['source_class'];
    deep_mining_passed: boolean;
    extracted_excerpt_count: number;
    primary_layer_hint: string[];
    evidence_strength_ceiling: string;
  };
}

/**
 * Deep Mining Probe Engine.
 *
 * Executes deep-dive probe analysis against high-value regulatory, disclosure,
 * academic, and clinical research leads following the deep-evidence-mining Skill.
 */
export function executeDeepMiningProbe(input: DeepMiningProbeInput): DeepMiningProbeResult {
  const { lead, rawBody, contentType, fetchedAt, httpStatus = 200 } = input;
  const extracted = extractReadableSource(rawBody, contentType, lead.url);
  const excerpts = deepExtractExcerpts(extracted.text);

  const ceiling = lead.source_class === 'official' ? 'E4' : lead.source_class === 'academic' ? 'E3' : 'E2';
  const primaryLayers = lead.source_class === 'official'
    ? ['reality', 'pricing', 'capital']
    : lead.source_class === 'academic'
      ? ['reality', 'name']
      : ['capital', 'pricing'];

  const retrievalItem: ResearchSourceRetrievalItem = {
    retrieval_id: `deep_probe_${hash(`${lead.triage_id}|${lead.url}`)}`,
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
    status: excerpts.length ? 'retrieved' : 'skipped',
    http_status: httpStatus,
    content_type: contentType,
    page_title: extracted.title,
    excerpts,
    content_hash: extracted.text ? hash(extracted.text) : null,
    error: excerpts.length ? null : 'deep_probe_found_no_citable_excerpts',
    evidence_eligibility: 'context_only',
    next_action: excerpts.length ? 'prepare_intake' : 'hold',
  };

  return {
    retrievalItem,
    probe_metadata: {
      probe_id: `probe_${hash(lead.url)}`,
      source_class: lead.source_class,
      deep_mining_passed: excerpts.length > 0,
      extracted_excerpt_count: excerpts.length,
      primary_layer_hint: primaryLayers,
      evidence_strength_ceiling: ceiling,
    },
  };
}

function deepExtractExcerpts(text: string): SourcePageExcerpt[] {
  const sentences = text
    .split(/\n{2,}|(?<=[。！？；.!?])\s*(?=[A-Z\u4e00-\u9fff【《])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 50)
    .filter((s) => !/(?:privacy policy|cookie settings|terms of use|版权所有|免责声明|联系我们)/i.test(s));

  const ranked = sentences
    .map((quote, index) => ({ quote, index, score: probeScore(quote) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .sort((a, b) => a.index - b.index);

  return ranked.map((item, idx) => {
    const start = text.indexOf(item.quote);
    return {
      quote: item.quote.slice(0, 800),
      quote_start_offset: Math.max(0, start),
      quote_end_offset: Math.max(0, start) + Math.min(item.quote.length, 800),
      location_label: `深度探针提取段落 ${idx + 1}`,
    };
  });
}

function probeScore(text: string): number {
  let score = Math.min(text.length, 800) / 100;
  if (/(?:批复|核准|批准|注册|上市|公告|决议|试验阶段|主要终点|临床|专利|授权|contract|approval|approved|clinical|trial|patent|licensing)/i.test(text)) score += 10;
  if (/\d+/.test(text)) score += 2;
  return score;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
