import { createHash } from 'node:crypto';
import type { ResearchPack, ResearchPackSource } from '@/features/research/types/research_pack';
import type { ResearchLeadFreshness, ResearchLeadTriageItem, ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';

const RETRIEVABLE_CLASSES = new Set(['official', 'company_primary', 'academic']);

/** Turns explicit, reviewed source targets into the same context-only triage
 * contract used by discovery. Source declarations are never claims. */
export function buildResearchPackTriage(input: { pack: ResearchPack; generatedAt: string; producerVersion: string }): ResearchLeadTriageReport {
  const unique = dedupeByScopeAndUrl(input.pack.sources);
  const items = unique.map((source) => triageItem(source, input.generatedAt));
  const summary = {
    priority_review_count: items.filter((item) => item.disposition === 'priority_review').length,
    review_count: items.filter((item) => item.disposition === 'review').length,
    reference_only_count: items.filter((item) => item.disposition === 'reference_only').length,
    hold_count: items.filter((item) => item.disposition === 'hold').length,
    duplicate_count: input.pack.sources.length - unique.length,
    official_or_academic_count: items.filter((item) => ['official', 'company_primary', 'academic'].includes(item.source_class)).length,
  };
  return {
    artifact_type: 'research_lead_triage_report', schema_version: '1.0.0', producer_version: input.producerVersion,
    triage_id: `research_pack_triage_${input.pack.pack_id}_${stamp(input.generatedAt)}`,
    generated_at: input.generatedAt, web_research_id: null, direct_research_id: null,
    input_lead_count: input.pack.sources.length, triaged_lead_count: items.length, summary, items,
    guardrail_check: { input_results_remain_context_only: true, no_auto_evidence_import: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_trading_advice: true },
  };
}

export function selectResearchPackRetrievalTargets(triage: ResearchLeadTriageReport, maxItems: number): ResearchLeadTriageItem[] {
  if (maxItems < 1) return [];
  return triage.items.filter((item) => ['priority_review', 'review'].includes(item.disposition))
    .filter((item) => RETRIEVABLE_CLASSES.has(item.source_class))
    .slice(0, maxItems);
}

function triageItem(source: ResearchPackSource, generatedAt: string): ResearchLeadTriageItem {
  const freshness = freshnessFor(source.published_at, generatedAt);
  const sourceWeight = source.source_class === 'official' ? 54 : source.source_class === 'company_primary' ? 48 : source.source_class === 'academic' ? 44 : source.source_class === 'secondary' ? 24 : source.source_class === 'reference' ? 10 : source.source_class === 'community' ? 16 : 18;
  const score = Math.min(100, sourceWeight + 24 + (freshness === 'fresh' ? 14 : freshness === 'recent' ? 7 : 0) + 8);
  const retrievable = RETRIEVABLE_CLASSES.has(source.source_class);
  const disposition = retrievable ? (score >= 70 ? 'priority_review' : 'review') : source.source_class === 'reference' ? 'reference_only' : 'hold';
  const domain = domainOf(source.url);
  return {
    triage_id: `triage_pack_${shortHash(`${source.source_id}|${source.topic_id}|${source.branch_id}|${source.url}`)}`,
    origin: 'direct', origin_lead_id: `pack_${source.source_id}`, duplicate_origin_lead_ids: [],
    topic_id: source.topic_id, branch_id: source.branch_id, candidate_node_id: source.candidate_node_id,
    title: source.title, url: source.url, source_name: domain || 'Curated research source', source_domain: domain,
    snippet: source.rationale, published_at: source.published_at, retrieved_at: generatedAt,
    source_class: source.source_class, relevance: 'explicit', freshness, priority_score: score,
    priority: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low', disposition,
    reasons: [
      '研究包中明确列出的原始来源目标',
      source.branch_id ? '保持分支 scope，不得升级父主题' : source.candidate_node_id ? '候选新主题不继承阶段，需 Topic Resolver 处理' : '已绑定现有主题 scope',
      source.rationale,
    ],
    next_action: retrievable ? (source.source_class === 'academic' ? 'retrieve_primary_source' : 'review_original') : 'hold',
    evidence_eligibility: 'context_only',
  };
}

function dedupeByScopeAndUrl(sources: ResearchPackSource[]): ResearchPackSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.topic_id ?? source.candidate_node_id ?? 'unresolved'}|${source.branch_id ?? 'parent'}|${canonicalUrl(source.url)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function freshnessFor(value: string | null, now: string): ResearchLeadFreshness {
  if (!value || !Number.isFinite(Date.parse(value))) return 'undated';
  const days = Math.max(0, (Date.parse(now) - Date.parse(value)) / 86_400_000);
  return days <= 90 ? 'fresh' : days <= 730 ? 'recent' : 'archive';
}

function domainOf(value: string): string { try { return new URL(value).hostname.toLowerCase(); } catch { return ''; } }
function canonicalUrl(value: string): string { try { const url = new URL(value); url.hash = ''; return url.toString().replace(/\/$/, '').toLowerCase(); } catch { return value.trim().toLowerCase(); } }
function shortHash(value: string): string { return createHash('sha256').update(value).digest('hex').slice(0, 12); }
function stamp(value: string): string { return value.replace(/[-:.TZ]/g, '').slice(0, 17); }
