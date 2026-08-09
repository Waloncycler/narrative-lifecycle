import { marketTopicName } from '@/features/narrative/domain/market_naming';
import type { AliasRecord, CanonicalTopicRecord, TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { WebResearchLead, WebResearchQuery } from '@/features/research/types/web_research';

const adviceText = /\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i;

export function buildWebResearchQueries(input: {
  registry: TopicRegistry;
  topicIds?: string[];
  queries?: string[];
  plannedQueries?: Array<{
    query: string;
    topic_id: string | null;
    branch_id: string | null;
    candidate_node_id?: string | null;
    campaign_task_id: string;
    source_ids: string[];
    source_domains: string[];
    strict_source_domains?: string[];
  }>;
  limit?: number;
}): WebResearchQuery[] {
  const explicitQueries = input.queries?.map((query) => query.trim()).filter(Boolean) ?? [];
  const selectedTopics = (input.plannedQueries?.length ? [] : input.registry.canonical_topics)
    .filter((topic) => topic.status === 'active')
    .filter((topic) => !input.topicIds?.length || input.topicIds.includes(topic.topic_id))
    .slice(0, input.limit ?? 6);
  const topicQueries = selectedTopics.flatMap((topic) => {
    // Terminology expansion: news and official pages rarely use the exact
    // combined "zh + en" 口径. Emit the combined query first (kept for
    // backwards compatibility), then every distinct Chinese/English name and
    // registry alias (abbreviations, alternative spellings) as its own query.
    // Searching only Chinese would miss foreign/English sources, and a mixed
    // zh+en query starves several free keyless upstreams.
    const terms = topicSearchTerms(topic, input.registry.aliases);
    const combined = `${marketTopicName(topic)} ${topic.market_name_en ?? ''}`.trim();
    return [
      { query: combined, topic_id: topic.topic_id, purpose: 'evidence_discovery' as const },
      ...terms
        .filter((term) => term.toLowerCase() !== combined.toLowerCase())
        .map((term) => ({ query: term, topic_id: topic.topic_id, purpose: 'evidence_discovery' as const })),
    ];
  });
  const adHoc = explicitQueries.map((query) => ({ query, topic_id: null, purpose: 'name_validation' as const }));
  const planned = input.plannedQueries?.map((item) => ({
    ...item,
    purpose: 'evidence_discovery' as const,
  })) ?? [];
  return [...planned, ...topicQueries, ...adHoc]
    .filter((item, index, all) => all.findIndex((other) => other.query.toLowerCase() === item.query.toLowerCase()) === index)
    .map((item, index) => ({ ...item, query_id: `web_query_${String(index + 1).padStart(2, '0')}_${shortHash(item.query)}` }));
}

/** Expands a topic into its searchable terminology: the Chinese market name,
 *  the English market name, and every registry alias (abbreviations such as
 *  "BCI", alternative spellings). Each distinct term becomes its own query so
 *  both Chinese and foreign-language sources are discovered instead of only
 *  one 口径. */
function topicSearchTerms(topic: CanonicalTopicRecord, aliases: AliasRecord[]): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();
  const add = (term: string | undefined): void => {
    const normalized = term?.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) return;
    seen.add(normalized.toLowerCase());
    terms.push(normalized);
  };
  add(marketTopicName(topic));
  add(topic.market_name_en);
  for (const alias of aliases.filter((item) => item.topic_id === topic.topic_id)) add(alias.alias);
  return terms;
}

export function normalizeWebResearchLeads(input: {
  query: WebResearchQuery;
  rows: Array<{ title?: string; url?: string; snippet?: string; source_name?: string; published_at?: string | null }>;
  retrievedAt: string;
  maxResults: number;
}): WebResearchLead[] {
  const seen = new Set<string>();
  const result: WebResearchLead[] = [];
  for (const row of input.rows) {
    const rawUrl = row.url?.trim();
    const title = row.title?.trim();
    if (!rawUrl || !title || seen.has(rawUrl) || adviceText.test(`${title} ${row.snippet ?? ''}`)) continue;
    let domain: string;
    let url: string;
    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) continue;
      domain = parsed.hostname.toLowerCase();
      url = parsed.href; // Percent-encodes non-ASCII paths (zh Wikipedia etc.).
    } catch { continue; }
    const strictDomains = input.query.strict_source_domains ?? input.query.source_domains;
    if (strictDomains?.length && !strictDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`))) continue;
    seen.add(url);
    result.push({
      lead_id: `web_lead_${shortHash(`${input.query.query_id}|${url}`)}`,
      query_id: input.query.query_id,
      topic_id: input.query.topic_id,
      branch_id: input.query.branch_id ?? null,
      candidate_node_id: input.query.candidate_node_id ?? null,
      title,
      url,
      source_name: row.source_name?.trim() || domain,
      source_domain: domain,
      snippet: (row.snippet ?? '').trim().slice(0, 800),
      published_at: normalizeDate(row.published_at),
      retrieved_at: input.retrievedAt,
      rank: result.length + 1,
      evidence_eligibility: 'context_only',
      next_action: input.query.purpose === 'name_validation' ? 'validate_market_name' : 'review_source',
    });
    if (result.length >= input.maxResults) break;
  }
  return result;
}

export function deduplicateWebResearchLeads(leads: WebResearchLead[]): WebResearchLead[] {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    const key = lead.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Accepts any Date.parse-able string (ISO, RFC 1123, etc.) and normalizes
 *  it to ISO 8601 date-time. Sources like Bing RSS return RFC 1123 dates
 *  ("Mon, 30 Jan 2023 14:41:00 GMT") which pass a Date.parse check but fail
 *  downstream schemas that require date/date-time formats. */
export function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}
