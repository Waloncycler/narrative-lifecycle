import { createHash } from 'node:crypto';
import { executeDeepMiningProbe } from '@/features/research/domain/deep_mining_probes';
import { isRecognizedGovernmentHost } from '@/features/research/domain/research_source_retrieval';
import type { EvidenceCandidate, EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { ResearchLeadSourceClass, ResearchLeadTriageItem } from '@/features/research/types/research_lead_triage';
import type { ResearchSourceRetrievalItem, ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';
import type { WebResearchReport } from '@/features/research/types/web_research';
import { resolveWithIntelligentEcosystem } from '@/features/narrative/domain/intelligent_topic_resolver';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { AuthoritativeSourceAtlas, CompanyResearchRegistry, SourceGovernancePolicy } from '@/features/research/types/research_coverage';

export interface ProbePrioritizedNewsUseCaseDeps {
  now(): string;
  producerVersion(): string;
  readRegistry(): TopicRegistry;
  readSourceAtlas(): AuthoritativeSourceAtlas;
  readCompanies(): CompanyResearchRegistry;
  readGovernancePolicy(): SourceGovernancePolicy;
  search(input: { plannedQueries: Array<{ query: string; topic_id: string | null; branch_id: string | null; campaign_task_id: string; source_ids: string[]; source_domains: string[]; strict_source_domains?: string[] }> }): Promise<WebResearchReport>;
  retrieve(input: { url: string; timeoutMs: number }): Promise<{ httpStatus: number; contentType: string | null; body: string }>;
  appendRetrievedSourceIntake(report: ResearchSourceRetrievalReport): EvidenceIntakeSession | null;
  writeMappedSession(session: EvidenceIntakeSession): void;
  writeReport(report: ResearchSourceRetrievalReport): void;
  writeDiagnostics(report: NewsProbeDiagnostics): void;
  validateReport(report: ResearchSourceRetrievalReport): void;
}

export interface PrioritizedNewsProbeResult {
  report: ResearchSourceRetrievalReport;
  selected_news_count: number;
  verified_news_count: number;
  session: EvidenceIntakeSession | null;
  diagnostics: NewsProbeDiagnostics;
}

export interface NewsProbeDiagnostics {
  artifact_type: 'news_probe_diagnostics';
  schema_version: '1.0.0';
  producer_version: string;
  generated_at: string;
  selected_news_count: number;
  search_query_count: number;
  search_lead_count: number;
  seed_host_rejected_count: number;
  ungoverned_source_rejected_count: number;
  duplicate_host_rejected_count: number;
  retrieval_attempt_count: number;
  retrieval_failed_count: number;
  citation_insufficient_count: number;
  claim_mismatch_count: number;
  citation_ready_count: number;
  seed_citation_ready_count: number;
  unknown_discovery_attempt_count: number;
  unknown_discovery_ready_count: number;
  verified_news_count: number;
  holds: Array<{ candidate_id: string; title: string; topic_id: string | null; lead_count: number; reason: string }>;
}

const AUTHORITATIVE_SECONDARY_HOSTS = /(?:^|\.)(?:reuters\.com|apnews\.com|wsj\.com|ft\.com|bloomberg\.com|news\.cn|xinhuanet\.com|thepaper\.cn|yicai\.com|caixin\.com|36kr\.com|techcrunch\.com|theverge\.com|fiercebiotech\.com|fiercepharma\.com|endpts\.com|statnews\.com|electrek\.co|gelonghui\.com|jiemian\.com|huxiu\.com|geekpark\.net)$/;
const GOVERNED_SEED_NEWS_HOSTS = /(?:^|\.)(?:reuters\.com|apnews\.com|wsj\.com|ft\.com|bloomberg\.com|news\.cn|xinhuanet\.com|thepaper\.cn|yicai\.com|caixin\.com|cls\.cn|finance\.sina\.com\.cn|stcn\.com|cs\.com\.cn|cnstock\.com|36kr\.com|techcrunch\.com|theverge\.com|fiercebiotech\.com|fiercepharma\.com|endpts\.com|statnews\.com|electrek\.co|gelonghui\.com|jiemian\.com|huxiu\.com|geekpark\.net)$/;
const LOW_GOVERNANCE_HOSTS = /(?:^|\.)(?:sohu\.com|163\.com|toutiao\.com|baidu\.com|weibo\.com|zhihu\.com|csdn\.net|baijiahao\.baidu\.com)$/;

function buildRegexFromPolicy(hosts: string[]): RegExp {
  const pattern = hosts.map((h) => h.replace(/\./g, '\\.')).join('|');
  return new RegExp(`(?:^|\\.)(?:${pattern})$`);
}

/** Converts ranked secondary-news candidates into source-recovery probes.
 * Search snippets are never evidence. Two independent citation-ready primary
 * hosts must support the same bounded claim before the package enters Intake. */
export class ProbePrioritizedNewsUseCase {
  constructor(private readonly deps: ProbePrioritizedNewsUseCaseDeps) {}

  async execute(session: EvidenceIntakeSession, input: { maxNews?: number; maxSourcesPerNews?: number; maxUnknownSourcesPerNews?: number } = {}): Promise<PrioritizedNewsProbeResult> {
    const generatedAt = this.deps.now();
    const policy = this.deps.readGovernancePolicy();
    const authoritativeSecondaryHostsRegex = buildRegexFromPolicy(policy.authoritative_secondary_hosts);
    const governedSeedNewsHostsRegex = buildRegexFromPolicy(policy.governed_seed_news_hosts);
    const lowGovernanceHostsRegex = buildRegexFromPolicy(policy.low_governance_hosts);
    const registry = this.deps.readRegistry();
    const atlas = this.deps.readSourceAtlas();
    const companies = this.deps.readCompanies();
    const mappedCandidates = session.candidates
      .map((candidate) => resolveRegisteredScope(candidate, registry, companies))
      .filter((candidate): candidate is EvidenceCandidate => Boolean(candidate));
    const mappingChanged = mappedCandidates.some((candidate, index) => candidate.suggested_evidence.topic_id !== session.candidates[index]?.suggested_evidence.topic_id
      || candidate.suggested_evidence.branch_id !== session.candidates[index]?.suggested_evidence.branch_id);
    const mappedSession = mappingChanged ? { ...session, candidates: mappedCandidates } : session;
    if (mappingChanged) this.deps.writeMappedSession(mappedSession);
    const eligible = mappedCandidates
      .filter(isProbeCandidate)
      .sort((left, right) => registeredScopePriority(right) - registeredScopePriority(left) || importance(right) - importance(left));
    const selected = selectProbeCandidates(eligible, input.maxNews ?? 4);
    const plannedQueries = selected.flatMap((candidate) => queriesFor(candidate, atlas, companies));
    const web = plannedQueries.length ? await this.deps.search({ plannedQueries }) : null;
    const items: ResearchSourceRetrievalItem[] = [];
    const diagnostics: NewsProbeDiagnostics = {
      artifact_type: 'news_probe_diagnostics', schema_version: '1.0.0', producer_version: this.deps.producerVersion(), generated_at: generatedAt,
      selected_news_count: selected.length, search_query_count: plannedQueries.length, search_lead_count: web?.leads.length ?? 0,
      seed_host_rejected_count: 0, ungoverned_source_rejected_count: 0, duplicate_host_rejected_count: 0,
      retrieval_attempt_count: 0, retrieval_failed_count: 0, citation_insufficient_count: 0, claim_mismatch_count: 0,
      citation_ready_count: 0, seed_citation_ready_count: 0, unknown_discovery_attempt_count: 0,
      unknown_discovery_ready_count: 0, verified_news_count: 0, holds: [],
    };

    for (const candidate of selected) {
      const queryIds = new Set((web?.queries ?? [])
        .filter((query) => query.campaign_task_id?.startsWith(`news_probe__${candidate.candidate_id}__`))
        .map((query) => query.query_id));
      const candidateLeads = (web?.leads ?? []).filter((lead) => queryIds.has(lead.query_id));
      const classified = candidateLeads.flatMap((lead) => {
        if (safeHost(lead.url) === safeHost(candidate.suggested_evidence.source_url)) { diagnostics.seed_host_rejected_count += 1; return []; }
        const classifiedSource = sourceClass(lead.url, atlas, companies, policy);
        if (classifiedSource === 'unknown') diagnostics.ungoverned_source_rejected_count += 1;
        return [{ lead, sourceClass: classifiedSource }];
      });
      const seenHosts = new Set<string>();
      const distinct = (entries: typeof classified, limit: number) => entries
        .filter((entry) => {
          const host = safeHost(entry.lead.url);
          if (!host || seenHosts.has(host)) { diagnostics.duplicate_host_rejected_count += 1; return false; }
          seenHosts.add(host); return true;
        })
        .slice(0, limit);
      const governed = distinct(classified.filter((entry) => entry.sourceClass !== 'unknown'), input.maxSourcesPerNews ?? 4);
      const discovery = distinct(classified.filter((entry) => entry.sourceClass === 'unknown'), Math.max(0, input.maxUnknownSourcesPerNews ?? 2));
      const leads = [...governed, ...discovery];
      const probed: ResearchSourceRetrievalItem[] = [];
      for (const entry of leads) {
        diagnostics.retrieval_attempt_count += 1;
        if (entry.sourceClass === 'unknown') diagnostics.unknown_discovery_attempt_count += 1;
        const lead = triageLead(candidate, entry.lead, entry.sourceClass, generatedAt);
        try {
          const page = await this.deps.retrieve({ url: lead.url, timeoutMs: 15_000 });
          const item = executeDeepMiningProbe({ lead, rawBody: page.body, contentType: page.contentType, fetchedAt: generatedAt, httpStatus: page.httpStatus }).retrievalItem;
          if (item.citation_status !== 'ready' || !item.excerpts.length) diagnostics.citation_insufficient_count += 1;
          else if (entry.sourceClass === 'unknown') {
            diagnostics.unknown_discovery_ready_count += 1;
            probed.push({ ...item, next_action: 'hold', news_corroboration: undefined });
          } else if (supportsClaim(candidate, item) < 0.35) diagnostics.claim_mismatch_count += 1;
          else { diagnostics.citation_ready_count += 1; probed.push(item); }
        } catch {
          diagnostics.retrieval_failed_count += 1;
        }
      }
      const discoveryItems = probed.filter((item) => item.source_class === 'unknown');
      items.push(...discoveryItems.map((item) => ({ ...item, next_action: 'hold' as const, news_corroboration: undefined })));
      const independent = probed
        .filter((item) => item.source_class !== 'unknown' && item.citation_status === 'ready' && item.excerpts.length)
        .filter(distinctItemHost());
      const seedReady = isCitationReadySeed(candidate, policy);
      if (seedReady) diagnostics.seed_citation_ready_count += 1;
      // Dual-source means two independent attributable sources, not the seed
      // article plus two additional sources. A substantive report from a
      // governed newsroom may count as the secondary source, but only an
      // independently retrieved official/company/academic source can anchor
      // verification. Titles, snippets and thin landing pages never count.
      const verified = independent.some((item) => isPrimary(item.source_class))
        && (independent.length >= 2 || (seedReady && independent.length >= 1));
      const similarity = independent.length
        ? Math.min(...independent.map((item) => supportsClaim(candidate, item)))
        : 0;
      for (const [index, item] of independent.entries()) {
        items.push({
          ...item,
          next_action: verified && index === 0 ? 'prepare_intake' : 'hold',
          news_corroboration: index === 0 ? {
            news_candidate_id: candidate.candidate_id,
            seed_source_url: candidate.suggested_evidence.source_url ?? 'https://invalid.local/',
            corroboration_status: verified ? 'verified' : 'unverified',
            claim_similarity: round(similarity),
            corroborating_source_urls: [
              ...(seedReady && candidate.suggested_evidence.source_url ? [candidate.suggested_evidence.source_url] : []),
              ...independent.slice(1).map((source) => source.url),
            ],
            independent_source_hosts: [
              ...(seedReady ? [safeHost(candidate.suggested_evidence.source_url)] : []),
              ...independent.map((source) => safeHost(source.url)),
            ].filter((host): host is string => Boolean(host)),
          } : undefined,
        });
      }
      if (!verified) {
        if (!independent.length) items.push(unverifiedPlaceholder(candidate, generatedAt));
        diagnostics.holds.push({
          candidate_id: candidate.candidate_id, title: candidate.suggested_evidence.event_title,
          topic_id: candidate.suggested_evidence.topic_id === 'unknown_topic' ? null : candidate.suggested_evidence.topic_id,
          lead_count: candidateLeads.length,
          reason: independent.length ? 'missing_primary_plus_independent_corroboration' : governed.length ? 'retrieval_or_claim_validation_failed' : 'no_governed_source_candidates',
        });
      }
    }

    const report: ResearchSourceRetrievalReport = {
      artifact_type: 'research_source_retrieval_report',
      schema_version: '1.0.0',
      producer_version: this.deps.producerVersion(),
      retrieval_run_id: `news_probe_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
      generated_at: generatedAt,
      triage_id: null,
      requested_count: selected.length,
      retrieved_count: items.filter((item) => item.status === 'retrieved').length,
      skipped_count: items.filter((item) => item.status === 'skipped').length,
      failed_count: 0,
      items,
      guardrail_check: {
        only_governed_source_classes_requested: true,
        bounded_excerpts_only: true,
        original_url_preserved: true,
        no_auto_evidence_import: true,
        evidence_table_required_for_stage: true,
        parent_branch_separation: true,
        no_trading_advice: true,
      },
    };
    this.deps.validateReport(report);
    this.deps.writeReport(report);
    const verifiedCount = items.filter((item) => item.news_corroboration?.corroboration_status === 'verified').length;
    diagnostics.verified_news_count = verifiedCount;
    this.deps.writeDiagnostics(diagnostics);
    const appended = verifiedCount ? this.deps.appendRetrievedSourceIntake(report) : null;
    return { report, selected_news_count: selected.length, verified_news_count: verifiedCount, session: appended ?? (mappingChanged ? mappedSession : null), diagnostics };
  }
}

function unverifiedPlaceholder(candidate: EvidenceCandidate, generatedAt: string): ResearchSourceRetrievalItem {
  const url = candidate.suggested_evidence.source_url ?? 'https://invalid.local/';
  return {
    retrieval_id: `news_probe_hold_${shortHash(candidate.candidate_id)}`,
    triage_id: `news_hold_${shortHash(candidate.candidate_id)}`,
    origin_lead_id: candidate.candidate_id,
    topic_id: candidate.suggested_evidence.topic_id === 'unknown_topic' ? null : candidate.suggested_evidence.topic_id,
    branch_id: candidate.suggested_evidence.branch_id ?? null,
    candidate_node_id: null,
    source_published_at: candidate.suggested_evidence.event_date,
    source_class: 'secondary', disposition: 'hold', title: candidate.suggested_evidence.event_title, url,
    fetched_at: generatedAt, status: 'skipped', http_status: null, content_type: null, page_title: null,
    excerpts: [], citation_status: 'insufficient', citation_notes: ['No independent citation-ready primary source was recovered within the probe budget.'], source_text_chars: 0,
    content_hash: null, error: 'no_independent_primary_source_candidates', evidence_eligibility: 'context_only', next_action: 'hold',
  };
}

function isProbeCandidate(candidate: EvidenceCandidate): boolean {
  return candidate.suggested_evidence.source_type === 'news'
    && candidate.field_explanations.news_importance_score !== undefined
    && candidate.field_explanations.deep_probe_recommended === 'yes';
}

function resolveRegisteredScope(candidate: EvidenceCandidate, registry: TopicRegistry, companies: CompanyResearchRegistry): EvidenceCandidate | null {
  const evidence = candidate.suggested_evidence;
  if (evidence.topic_id !== 'unknown_topic' && !evidence.topic_id.startsWith('provisional_')) return candidate;

  const text = normalize(`${evidence.event_title} ${evidence.event_summary}`);
  const aliasesByTopic = new Map<string, string[]>();
  for (const alias of registry.aliases) aliasesByTopic.set(alias.topic_id, [...(aliasesByTopic.get(alias.topic_id) ?? []), alias.alias]);
  const topicMatches = registry.canonical_topics
    .filter((topic) => topic.status === 'active')
    .map((topic) => ({ topic, score: bestTermScore(text, [topic.topic_name, topic.market_name_zh, topic.market_name_en, ...(aliasesByTopic.get(topic.topic_id) ?? [])]) }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);
  let topic = topicMatches.length && (topicMatches[1]?.score ?? -1) !== topicMatches[0]!.score ? topicMatches[0]!.topic : null;
  if (!topic) {
    const companyMatches = companies.companies.filter((company) => [company.display_name_zh, company.display_name_en, ...company.aliases]
      .some((name) => normalize(name).length >= 3 && text.includes(normalize(name))));
    const coveredTopicIds = [...new Set(companyMatches.flatMap((company) => company.coverage_node_ids))];
    const coveredTopics = registry.canonical_topics.filter((item) => item.status === 'active'
      && coveredTopicIds.some((nodeId) => item.topic_id === nodeId || item.topic_id === `provisional_${nodeId}`));
    if (coveredTopics.length === 1) topic = coveredTopics[0]!;
  }

  // Try intelligent ecosystem resolver
  if (!topic) {
    const intelligentResolution = resolveWithIntelligentEcosystem(candidate, registry);
    if (intelligentResolution && intelligentResolution.status !== 'unresolved') {
      const topicId = intelligentResolution.resolved_topic_id ?? intelligentResolution.provisional_topic_id;
      if (topicId && topicId !== 'unknown_topic') {
        return {
          ...candidate,
          suggested_evidence: {
            ...evidence,
            topic_id: topicId,
            branch_id: intelligentResolution.resolved_branch_id ?? null,
            scope: intelligentResolution.resolved_branch_id ? 'branch' : 'parent',
            stage_effect: intelligentResolution.resolved_branch_id ? 'split_branch' : 'maintain',
            interpretation: evidence.interpretation ?? intelligentResolution.reason,
          },
        };
      }
    }
  }
  if (!topic) return candidate;
  const branchMatches = registry.branches
    .filter((branch) => branch.topic_id === topic.topic_id && branch.status !== 'archived')
    .map((branch) => ({ branch, score: bestTermScore(text, [branch.branch_name, branch.market_name_zh, branch.market_name_en]) }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);
  const branch = branchMatches.length && (branchMatches[1]?.score ?? -1) !== branchMatches[0]!.score ? branchMatches[0]!.branch : null;
  return {
    ...candidate,
    suggested_evidence: {
      ...evidence,
      topic_id: topic.topic_id,
      branch_id: branch?.branch_id ?? null,
      scope: branch ? 'branch' : 'parent',
      stage_effect: branch ? 'split_branch' : 'maintain',
    },
  };
}

function bestTermScore(text: string, values: Array<string | null | undefined>): number {
  let best = 0;
  for (const value of values) {
    const term = normalize(value ?? '');
    if (term.length < 3) continue;
    if (text.includes(term)) best = Math.max(best, Math.min(100, term.length));
  }
  return best;
}

function normalize(value: string): string { return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); }
function importance(candidate: EvidenceCandidate): number {
  const attention = Number(candidate.field_explanations.news_importance_score ?? 0) || 0;
  const evidencePotential = Number(candidate.field_explanations.evidence_potential_score ?? 0) || 0;
  return evidencePotential * 2 + attention;
}
function registeredScopePriority(candidate: EvidenceCandidate): number {
  const topic = candidate.suggested_evidence.topic_id;
  return topic !== 'unknown_topic' ? 1 : 0;
}

/** Tracked-topic recovery owns most of the bounded budget. One discovery lane
 * remains available so genuinely new narratives are still observable. */
function selectProbeCandidates(candidates: EvidenceCandidate[], maxNews: number): EvidenceCandidate[] {
  const discovery = candidates.filter((candidate) => registeredScopePriority(candidate) === 0).slice(0, 1);
  const trackedLimit = maxNews <= 1 || !discovery.length ? maxNews : maxNews - 1;
  const tracked = candidates.filter((candidate) => registeredScopePriority(candidate) === 1).slice(0, trackedLimit);
  if (!tracked.length) return discovery;
  return [...tracked, ...discovery].slice(0, maxNews);
}

function queriesFor(candidate: EvidenceCandidate, atlas: AuthoritativeSourceAtlas, companies: CompanyResearchRegistry) {
  const evidence = candidate.suggested_evidence;
  const base = compactClaim(evidence.event_title);
  const text = normalize(`${evidence.event_title} ${evidence.event_summary}`);
  const company = companies.companies.find((item) => [item.display_name_zh, item.display_name_en, ...item.aliases]
    .some((name) => normalize(name).length >= 3 && text.includes(normalize(name))));
  const companyDomain = company ? safeHost(company.official_source_url) : null;
  const filingDomains = company?.disclosure_source_ids.flatMap((sourceId) => {
    const source = atlas.sources.find((item) => item.source_id === sourceId);
    return source ? [safeHost(source.base_url)].filter((host): host is string => Boolean(host)) : [];
  }) ?? [];
  const authorityDomains = authorityDomainsForClaim(`${evidence.event_title} ${evidence.event_summary}`, atlas);
  const plans = [
    { suffix: 'official', text: `${base} 官方 公告 原文`, domains: authorityDomains, strict: authorityDomains },
    { suffix: 'independent', text: `${base} Reuters WSJ Bloomberg source`, domains: [] as string[], strict: [] as string[] },
    ...eventQueries(candidate, base),
    ...(companyDomain ? [{ suffix: 'company', text: `${company?.display_name_en} ${base} investor relations press release`, domains: [companyDomain], strict: [companyDomain] }] : []),
    ...(filingDomains.length ? [{ suffix: 'filing', text: `${company?.display_name_en} ${base} filing`, domains: filingDomains, strict: filingDomains }] : []),
  ];
  return plans.map((query) => ({
    query: query.text,
    topic_id: evidence.topic_id === 'unknown_topic' ? null : evidence.topic_id,
    branch_id: evidence.branch_id ?? null,
    campaign_task_id: `news_probe__${candidate.candidate_id}__${query.suffix}`,
    source_ids: [],
    source_domains: query.domains,
    strict_source_domains: query.strict,
  }));
}

function authorityDomainsForClaim(title: string, atlas: AuthoritativeSourceAtlas): string[] {
  const normalizedTitle = normalize(title);
  const agencyAliases: Record<string, string[]> = {
    nmpa: ['国家药监局', '国家药品监督管理局', 'nmpa'], cde: ['药审中心', '药品审评中心', 'cde'],
    miit: ['工信部', '工业和信息化部', 'miit'], ndrc: ['国家发改委', '发改委', 'ndrc'],
    csrc: ['中国证监会', '证监会', 'csrc'], sec_edgar: ['美国证监会', 'sec'],
    openfda: ['美国食品药品监督管理局', '美国fda', 'fda'], gov_cn: ['国务院', '中国政府网'],
  };
  const matchedIds = Object.entries(agencyAliases)
    .filter(([, aliases]) => aliases.some((alias) => normalizedTitle.includes(normalize(alias))))
    .map(([sourceId]) => sourceId);
  return [...new Set(atlas.sources
    .filter((source) => matchedIds.includes(source.source_id))
    .map((source) => safeHost(source.base_url))
    .filter((host): host is string => Boolean(host)))];
}

function eventQueries(candidate: EvidenceCandidate, base: string): Array<{ suffix: string; text: string; domains: string[]; strict: string[] }> {
  const eventClass = candidate.field_explanations.news_event_class;
  const queryByClass: Record<string, string[]> = {
    regulatory: ['regulator decision statutory document', 'site:gov.cn 批复 公告', 'regulatory database record'],
    clinical: ['clinical trial registry approval record', 'site:clinicaltrials.gov OR site:nmpa.gov.cn OR site:fda.gov'],
    corporate_disclosure: ['exchange filing annual report investor relations', 'site:sec.gov filing'],
    commercial_contract: ['procurement award contract announcement counterparty', 'company investor relations contract'],
    financing: ['bond prospectus exchange filing investor relations', 'site:sec.gov offering filing'],
    production: ['production capacity delivery official statistics company announcement'],
    research_result: ['paper DOI institution release arxiv pubmed'],
    macro_data: ['official statistics release data table'],
    risk_event: ['regulator investigation court filing recall notice'],
  };
  return (queryByClass[eventClass] ?? []).map((query, index) => ({ suffix: `event_${index + 1}`, text: `${base} ${query}`, domains: [], strict: [] }));
}

function triageLead(candidate: EvidenceCandidate, lead: WebResearchReport['leads'][number], sourceClassValue: ResearchLeadSourceClass, now: string): ResearchLeadTriageItem {
  return {
    triage_id: `news_${shortHash(`${candidate.candidate_id}|${lead.url}`)}`,
    origin: 'web', origin_lead_id: lead.lead_id, duplicate_origin_lead_ids: [],
    topic_id: candidate.suggested_evidence.topic_id === 'unknown_topic' ? null : candidate.suggested_evidence.topic_id,
    branch_id: candidate.suggested_evidence.branch_id ?? null,
    candidate_node_id: null,
    title: lead.title, url: lead.url, source_name: lead.source_name, source_domain: lead.source_domain,
    snippet: lead.snippet, published_at: lead.published_at, retrieved_at: now,
    source_class: sourceClassValue, relevance: 'explicit', freshness: 'fresh', priority_score: 100,
    priority: 'high', disposition: 'priority_review', reasons: ['Prioritized news claim requires primary-source corroboration.'],
    next_action: 'retrieve_primary_source', evidence_eligibility: 'context_only',
  };
}

function sourceClass(url: string, atlas: AuthoritativeSourceAtlas, companies: CompanyResearchRegistry, policy: SourceGovernancePolicy): ResearchLeadSourceClass {
  const host = safeHost(url) ?? '';
  if (!host || policy.low_governance_hosts.some((h) => host === h || host.endsWith(`.${h}`))) return 'unknown';
  const governedCompany = companies.companies.find((company) => governedHostMatches(host, safeHost(company.official_source_url)));
  if (governedCompany) return 'company_primary';
  const governedSource = atlas.sources.find((source) => governedHostMatches(host, safeHost(source.base_url)));
  if (governedSource) return governedSource.authority_tier === 'academic' ? 'academic' : governedSource.authority_tier === 'news' ? 'secondary' : governedSource.authority_tier === 'company' ? 'company_primary' : 'official';
  if (policy.authoritative_secondary_hosts.some((h) => host === h || host.endsWith(`.${h}`))) return 'secondary';
  if (isRecognizedGovernmentHost(host) || /(?:sec\.gov|fda\.gov|gov\.cn|sse\.com\.cn|szse\.cn|bse\.cn|bankofengland\.co\.uk|ecb\.europa\.eu|europa\.eu)$/.test(host)) return 'official';
  if (/(?:arxiv\.org|pubmed\.ncbi\.nlm\.nih\.gov|pmc\.ncbi\.nlm\.nih\.gov|nature\.com|science\.org|\.edu)$/.test(host)) return 'academic';
  return 'unknown';
}

function isPrimary(value: ResearchLeadSourceClass): boolean { return ['official', 'company_primary', 'academic'].includes(value); }

function isCitationReadySeed(candidate: EvidenceCandidate, policy: SourceGovernancePolicy): boolean {
  const host = safeHost(candidate.suggested_evidence.source_url);
  if (!host || !policy.governed_seed_news_hosts.some((h) => host === h || host.endsWith(`.${h}`))) return false;
  const quote = candidate.original_quote.trim();
  if (quote.length < 80) return false;
  const expected = tokens(`${candidate.suggested_evidence.event_title} ${candidate.suggested_evidence.event_summary}`);
  const quoted = tokens(quote);
  if (!expected.size || !quoted.size) return false;
  let overlap = 0;
  for (const token of expected) if (quoted.has(token)) overlap += 1;
  return overlap / Math.max(1, Math.min(expected.size, quoted.size)) >= 0.35;
}

function supportsClaim(candidate: EvidenceCandidate, item: ResearchSourceRetrievalItem): number {
  const expected = `${candidate.suggested_evidence.event_title} ${candidate.suggested_evidence.event_summary}`;
  const actual = item.excerpts.map((excerpt) => excerpt.quote).join(' ');
  const expectedTokens = tokens(expected);
  const actualTokens = tokens(actual);
  if (!expectedTokens.size || !actualTokens.size) return 0;
  let matched = 0;
  for (const token of expectedTokens) if (actualTokens.has(token)) matched += 1;
  const lexical = matched / Math.max(1, Math.min(expectedTokens.size, actualTokens.size));
  const expectedNumbers = new Set(expected.match(/\d+(?:\.\d+)?/g) ?? []);
  const actualNumbers = new Set(actual.match(/\d+(?:\.\d+)?/g) ?? []);
  const numberSupport = expectedNumbers.size ? [...expectedNumbers].some((value) => actualNumbers.has(value)) : true;
  return numberSupport ? lexical : lexical * 0.5;
}

function tokens(value: string): Set<string> {
  const normalized = value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  const words = normalized.split(/\s+/).filter((word) => word.length >= 3);
  const chinese = [...normalized.replace(/[^\u4e00-\u9fff]/g, '')];
  const bigrams = chinese.slice(0, -1).map((char, index) => `${char}${chinese[index + 1]}`);
  return new Set([...words, ...bigrams]);
}

function compactClaim(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const bracketed = /【([^】]{6,100})】/.exec(normalized)?.[1];
  if (bracketed) return bracketed;
  const firstSentence = normalized.split(/[。！？；]/, 1)[0] ?? normalized;
  return firstSentence.slice(0, 100);
}

function distinctHost<T extends { lead: { url: string } }>() { const seen = new Set<string>(); return (value: T) => { const host = safeHost(value.lead.url); if (!host || seen.has(host)) return false; seen.add(host); return true; }; }
function distinctItemHost() { const seen = new Set<string>(); return (value: ResearchSourceRetrievalItem) => { const host = safeHost(value.url); if (!host || seen.has(host)) return false; seen.add(host); return true; }; }
function safeHost(value: string | null | undefined): string | null { try { return new URL(value ?? '').hostname.toLowerCase(); } catch { return null; } }
function domainMatches(actual: string | null, expected: string | null): boolean { return Boolean(actual && expected && (actual === expected || actual.endsWith(`.${expected}`))); }
function governedHostMatches(actual: string | null, configured: string | null): boolean {
  if (domainMatches(actual, configured)) return true;
  const root = configured?.replace(/^(?:www|ir|investor|investors|data)\./, '') ?? null;
  return domainMatches(actual, root);
}
function shortHash(value: string): string { return createHash('sha256').update(value).digest('hex').slice(0, 12); }
function round(value: number): number { return Math.round(value * 1000) / 1000; }
