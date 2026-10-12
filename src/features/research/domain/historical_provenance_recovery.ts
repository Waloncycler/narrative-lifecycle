import { createHash } from 'node:crypto';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import { buildFailedSourceItem, buildRetrievedSourceItem } from '@/features/research/domain/research_source_retrieval';
import type { ResearchLeadSourceClass, ResearchLeadTriageItem } from '@/features/research/types/research_lead_triage';
import type { ResearchSourceRetrievalItem } from '@/features/research/types/research_source_retrieval';
import type { HistoricalProvenanceRecoveryItem, HistoricalProvenanceRecoveryReport, HistoricalProvenanceRecoveryTarget } from '@/features/research/types/historical_provenance_recovery';

type SearchRow = { title?: string; url?: string; snippet?: string; source_name?: string; published_at?: string | null };
type RetrievedPage = { httpStatus: number; contentType: string | null; body: string };

/** Selects legacy rows that lack an Evidence-grade excerpt. Operational rows
 * are intentionally excluded; recovering a historic source must never edit an
 * already-admitted Evidence record. */
export function selectHistoricalProvenanceTargets(input: {
  evidence: EvidenceNode[];
  registry: TopicRegistry;
  admittedEvidenceIds: Set<string>;
  limit: number;
  includeEvidenceGrade?: boolean;
  requireTopicTitleMatch?: boolean;
}): HistoricalProvenanceRecoveryTarget[] {
  const topicTerms = new Map(input.registry.canonical_topics.map((topic) => [topic.topic_id, [topic.topic_name, topic.market_name_zh, topic.market_name_en, ...input.registry.aliases.filter((alias) => alias.topic_id === topic.topic_id).map((alias) => alias.alias)].filter((value): value is string => Boolean(value?.trim()))]));
  return input.evidence
    .filter((item) => !input.admittedEvidenceIds.has(item.evidence_id))
    .filter((item) => Boolean(item.evidence_id && item.topic_id && item.event_title && item.event_date))
    // Baseline verification intentionally rechecks long historic summaries:
    // summary length is not evidence of source provenance.
    .filter((item) => input.includeEvidenceGrade || !hasEvidenceGradeExcerpt(item))
    // A reconciled baseline may be titled after a company or a policy document
    // rather than repeating its controlled market-topic label.
    .filter((item) => input.requireTopicTitleMatch === false || titleSupportsTopic(item.event_title, topicTerms.get(item.topic_id) ?? []))
    .map((item) => {
      const scope = item.parent_or_branch === 'branch' || item.branch_id ? 'branch' as const : 'parent' as const;
      const name = topicTerms.get(item.topic_id)?.[0] ?? item.topic_id;
      const exact = item.event_title.trim().slice(0, 240);
      const host = safeHost(item.source_url);
      return {
        legacy_evidence_id: item.evidence_id,
        topic_id: item.topic_id,
        branch_id: scope === 'branch' ? item.branch_id ?? null : null,
        scope,
        event_title: exact,
        event_date: item.event_date,
        known_source_url: validHttpUrl(item.source_url) ? item.source_url! : null,
        known_source_type: item.source_type ?? item.source_name ?? null,
        search_queries: unique([
          `"${exact}"`,
          `${exact} ${name} original source`,
          host ? `"${exact}" site:${host}` : '',
        ]).slice(0, 3),
      };
    })
    .sort((a, b) => recoveryPriority(b).localeCompare(recoveryPriority(a)) || b.event_date.localeCompare(a.event_date) || a.legacy_evidence_id.localeCompare(b.legacy_evidence_id))
    .slice(0, Math.max(0, input.limit));
}

export async function recoverHistoricalProvenance(input: {
  targets: HistoricalProvenanceRecoveryTarget[];
  generatedAt: string;
  producerVersion: string;
  searchProvider: string;
  search(query: string): Promise<SearchRow[]>;
  retrieve(url: string): Promise<RetrievedPage>;
  maxSourcesPerTarget: number;
  sourceUrlsByEvidenceId?: Record<string, string[]>;
}): Promise<HistoricalProvenanceRecoveryReport> {
  const items: HistoricalProvenanceRecoveryItem[] = [];
  for (const target of input.targets) {
    const urls = await discoverUrls(target, input.search, input.maxSourcesPerTarget, input.sourceUrlsByEvidenceId?.[target.legacy_evidence_id] ?? []);
    const retrieved: ResearchSourceRetrievalItem[] = [];
    for (const url of urls) {
      const lead = leadFor(target, url);
      try {
        const page = await input.retrieve(url);
        retrieved.push(buildRetrievedSourceItem({ lead, fetchedAt: input.generatedAt, ...page }));
      } catch (error) {
        retrieved.push(buildFailedSourceItem({ lead, fetchedAt: input.generatedAt, error: safeError(error) }));
      }
    }
    items.push(corroborate(target, retrieved));
  }
  const count = (status: HistoricalProvenanceRecoveryItem['corroboration_status']) => items.filter((item) => item.corroboration_status === status).length;
  return {
    artifact_type: 'historical_provenance_recovery_report', schema_version: '1.0.0', producer_version: input.producerVersion,
    recovery_run_id: `historical_provenance_${input.generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
    generated_at: input.generatedAt, search_provider: input.searchProvider,
    requested_target_count: input.targets.length,
    recovered_target_count: items.filter((item) => item.retrieved_sources.some((source) => source.status === 'retrieved')).length,
    auto_intake_ready_count: count('auto_intake_ready'),
    citation_ready_unverified_count: count('citation_ready_but_unverified'),
    insufficient_count: count('insufficient'),
    items,
    guardrail_check: {
      search_results_not_evidence: true, original_page_quotes_required: true, two_independent_sources_required_for_auto_intake: true,
      parent_branch_separation: true, same_scope_corroboration_only: true, existing_stage_unchanged: true, no_direct_evidence_import: true, no_trading_advice: true,
    },
  };
}

function corroborate(target: HistoricalProvenanceRecoveryTarget, sources: ResearchSourceRetrievalItem[]): HistoricalProvenanceRecoveryItem {
  const ready = sources.filter((source) => source.status === 'retrieved' && source.citation_status === 'ready' && source.excerpts.length)
    .filter((source) => eventTitleMatches(target.event_title, source.page_title ?? source.title));
  const primary = ready.find((source) => ['official', 'company_primary', 'academic'].includes(source.source_class));
  const independent = distinctByHost(primary ? [primary, ...ready.filter((source) => source.retrieval_id !== primary.retrieval_id)] : ready);
  const verified = Boolean(primary) && independent.length >= 2;
  const marked = sources.map((source) => {
    if (!primary || source.retrieval_id !== primary.retrieval_id) {
      return source.status === 'retrieved' && source.citation_status === 'ready'
        ? { ...source, next_action: 'hold' as const, citation_notes: [...(source.citation_notes ?? []), 'Used only as cross-source corroboration for a separate historical recovery primary.'] }
        : source;
    }
    return {
      ...source,
      next_action: verified ? 'prepare_intake' as const : 'hold' as const,
      historical_recovery: {
        legacy_evidence_id: target.legacy_evidence_id,
        event_date: target.event_date,
        scope: target.scope,
        branch_id: target.branch_id,
        corroboration_status: verified ? 'verified' as const : 'unverified' as const,
        corroborating_source_urls: independent.slice(1).map((item) => item.url),
        independent_source_hosts: independent.map((item) => safeHost(item.url)).filter((value): value is string => Boolean(value)),
      },
    };
  });
  const status = verified ? 'auto_intake_ready' : ready.length ? 'citation_ready_but_unverified' : 'insufficient';
  const reason = verified
    ? 'Two distinct source hosts returned citation-ready excerpts with a matching event title. The primary package may enter the existing agent and policy pipeline.'
    : ready.length ? 'Citation-ready source exists, but independent cross-source corroboration is incomplete.' : 'No citation-ready original-source excerpt matched the historic event title.';
  return { recovery_id: `history_recovery_${shortHash(target.legacy_evidence_id)}`, target, retrieved_sources: marked, independent_source_hosts: independent.map((item) => safeHost(item.url)).filter((value): value is string => Boolean(value)), corroboration_status: status, reason };
}

async function discoverUrls(target: HistoricalProvenanceRecoveryTarget, search: (query: string) => Promise<SearchRow[]>, max: number, seededUrls: string[]): Promise<string[]> {
  const discovered = await Promise.all(target.search_queries.map(async (query) => {
    try { return await search(query); } catch { return []; }
  }));
  const rows = discovered.flat();
  const candidates = [target.known_source_url, ...seededUrls, ...rows
    .filter((row) => eventTitleMatches(target.event_title, row.title ?? ''))
    .map((row) => row.url ?? null)];
  return unique(candidates.filter((url): url is string => validHttpUrl(url) && sourceClassForTarget(target, url) !== 'unknown')).slice(0, Math.max(1, max));
}

function leadFor(target: HistoricalProvenanceRecoveryTarget, url: string): ResearchLeadTriageItem {
  const sourceClass = sourceClassForTarget(target, url);
  return {
    triage_id: `historical_${shortHash(`${target.legacy_evidence_id}|${url}`)}`,
    origin: 'web',
    origin_lead_id: `legacy_${target.legacy_evidence_id}`,
    duplicate_origin_lead_ids: [],
    topic_id: target.topic_id,
    branch_id: target.branch_id,
    candidate_node_id: null,
    source_class: sourceClass,
    disposition: 'priority_review',
    title: target.event_title,
    url,
    source_name: safeHost(url) ?? 'Historical source',
    source_domain: safeHost(url) ?? 'unknown',
    snippet: '',
    published_at: target.event_date,
    retrieved_at: target.event_date,
    relevance: 'explicit',
    freshness: 'archive',
    priority_score: 100,
    priority: 'high',
    reasons: ['Historic record requires original-page provenance recovery.'],
    next_action: 'retrieve_primary_source',
    evidence_eligibility: 'context_only',
  };
}

function sourceClassForUrl(value: string): ResearchLeadSourceClass {
  const host = safeHost(value) ?? '';
  if (/(^|\.)(gov|gov\.cn|europa\.eu|fda\.gov|clinicaltrials\.gov|federalregister\.gov|sec\.gov|sse\.com\.cn|szse\.cn|bse\.cn)$/.test(host) || host.endsWith('.gov') || host.endsWith('.gov.cn')) return 'official';
  // DOI resolvers are landing/redirect endpoints, not original pages. They
  // may be used in the search query but never as a source citation.
  if (host === 'doi.org' || host.endsWith('.doi.org')) return 'unknown';
  if (/(arxiv\.org|pubmed\.ncbi\.nlm\.nih\.gov|pmc\.ncbi\.nlm\.nih\.gov|openalex\.org|osti\.gov|link\.springer\.com|sciencedirect\.com|nature\.com|onlinelibrary\.wiley\.com|journals\.aps\.org|ieeexplore\.ieee\.org|\.edu$)/.test(host)) return 'academic';
  if (/(sec\.gov|edgar|exchange|disclosure)/.test(host)) return 'official';
  if (/(apnews\.com|reuters\.com|prnewswire\.com|businesswire\.com|axios\.com|time\.com|cnbc\.com|bloomberg\.com|yicai\.com|stcn\.com|cnstock\.com|cs\.com\.cn|21jingji\.com)/.test(host)) return 'secondary';
  if (/(kyodonewsprwire\.jp|spartanweeklyonline\.com)/.test(host)) return 'secondary';
  return 'unknown';
}

/** A company source is accepted only when it is the same controlled legacy
 * source host. Generic company-looking search results remain untrusted. */
function sourceClassForTarget(target: HistoricalProvenanceRecoveryTarget, url: string): ResearchLeadSourceClass {
  const inferred = sourceClassForUrl(url);
  if (inferred !== 'unknown') return inferred;
  const expectedCompany = target.known_source_type === 'company' || target.known_source_type === 'company_primary';
  if (expectedCompany && /(prnewswire\.com|businesswire\.com)/.test(safeHost(url) ?? '')) return 'company_primary';
  if (expectedCompany && safeHost(url) && safeHost(url) === safeHost(target.known_source_url)) return 'company_primary';
  return 'unknown';
}

function hasEvidenceGradeExcerpt(item: EvidenceNode): boolean { return (item.event_summary?.trim().length ?? 0) >= 120; }
function validHttpUrl(value: string | undefined | null): value is string { try { const url = new URL(value ?? ''); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; } }
function safeHost(value: string | undefined | null): string | null { try { return new URL(value ?? '').hostname.toLowerCase(); } catch { return null; } }
function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
function shortHash(value: string): string { return createHash('sha256').update(value).digest('hex').slice(0, 12); }
function safeError(error: unknown): string { return (error instanceof Error ? error.message : String(error)).replace(/(api[_-]?key|authorization|token|secret)\s*[=:]\s*\S+/gi, '$1=[redacted]').slice(0, 280); }
function distinctByHost(items: ResearchSourceRetrievalItem[]): ResearchSourceRetrievalItem[] {
  const hosts = new Set<string>();
  return items.filter((item) => { const host = safeHost(item.url); if (!host || hosts.has(host)) return false; hosts.add(host); return true; });
}
function titleSimilarity(left: string, right: string): number {
  const tokens = (value: string) => new Set(value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((part) => part.length > 2));
  const a = tokens(left); const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0; for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(1, Math.min(a.size, b.size));
}

function eventTitleMatches(left: string, right: string): boolean {
  if (titleSimilarity(left, right) >= 0.45) return true;
  const anchors = (value: string) => new Set(
    value.toLowerCase().match(/[a-z][a-z0-9.-]{1,}|\d+(?:\.\d+)?/g) ?? [],
  );
  const a = anchors(left);
  const b = anchors(right);
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared >= 2;
}

function titleSupportsTopic(title: string, terms: string[]): boolean {
  const normalizedTitle = title.toLowerCase();
  return terms.some((term) => {
    const clean = term.trim().toLowerCase();
    if (clean.length < 3) return false;
    if (normalizedTitle.includes(clean)) return true;
    const tokens = clean.replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((token) => token.length > 2);
    if (tokens.length < 2) return false;
    const matched = tokens.filter((token) => normalizedTitle.includes(token)).length;
    return matched >= 2;
  });
}

function recoveryPriority(target: HistoricalProvenanceRecoveryTarget): string {
  const url = target.known_source_url ?? '';
  const pathDepth = (() => { try { return new URL(url).pathname.split('/').filter(Boolean).length; } catch { return 0; } })();
  return String(Math.min(9, pathDepth));
}
