import type { ResearchCampaignTask } from '@/features/research/types/research_coverage';
import type { WebResearchLead } from '@/features/research/types/web_research';

/**
 * Deterministic follow-up query planner for iterative deep research.
 *
 * The multi-round sweep is analyst-like but intentionally keeps the search
 * iteration deterministic: follow-up angles come from the previous round's
 * leads (their most specific title phrase, contextualized by the lead's
 * topic/branch scope), never from an unfettered model loop. Scope metadata
 * (topic/branch/campaign task/sources) is carried through so every lead stays
 * attributable to the campaign family it was discovered under.
 */

/** A follow-up query shaped like the source-aware planned queries the web
 *  research use case accepts, so scope metadata survives into the leads. */
export interface DeepResearchPlannedQuery {
  query: string;
  topic_id: string | null;
  branch_id: string | null;
  candidate_node_id?: string | null;
  campaign_task_id: string;
  source_ids: string[];
  source_domains: string[];
  strict_source_domains?: string[];
}

export function scopeKey(topicId: string | null, branchId: string | null): string {
  return `${topicId ?? 'null'}|${branchId ?? 'null'}`;
}

/** Indexes campaign tasks by scope (topic|branch and topic-only fallback) so
 *  follow-up queries can inherit the task's names, sources, and campaign id. */
export function buildScopeNames(tasks: ResearchCampaignTask[]): Map<string, ResearchCampaignTask> {
  const byScope = new Map<string, ResearchCampaignTask>();
  for (const task of tasks) {
    byScope.set(scopeKey(task.topic_id, task.branch_id), task);
    byScope.set(scopeKey(task.topic_id, null), task);
  }
  return byScope;
}

/** Token/part delimiters used to carve a title into candidate keyphrases. */
const PART_DELIMITERS = /[\s,，。；;、（）()\[\]【】"'“”‘’《》|/—\-–…?:：!.!]+/;

/**
 * Follow-up quality gate (Skill §8). Navigation/boilerplate words never
 * become research queries: "Navigation pages do not generate research
 * queries." The set holds whitespace-stripped lowercase forms so exact
 * matches like "Relations", "关于我们", or a bare year are rejected before
 * they reach the search engine.
 */
const NOISE_PHRASES = new Set([
  'relations', 'investorrelations', 'investor', 'investors',
  'about', 'aboutus', 'home', 'homepage',
  'news', 'newsroom', 'companyprofile', 'products', 'services',
  'careers', 'contact', 'contactus', 'login', 'register', 'signin', 'faq',
  'terms', 'privacy', 'sitemap',
  'press', 'releases', 'release', 'pressreleases', 'overview',
  'quarterly', 'quarterlyresults', 'results', 'filings', 'filing',
  'download', 'listen', 'announcements', 'announcement', 'continue',
  'category', 'description', 'date', 'more',
  'corporation', 'corporations', 'presentation', 'presentations',
  'shareholder', 'shareholders', 'shareholderdeck', 'deck', 'stock', 'investordeck',
  '首页', '关于我们', '联系我们', '新闻', '产品', '服务', '公司简介',
  '官方', '官网', '投资者关系', '投资者', '招聘', '登录', '注册', '下载',
  '帮助', '常见问题', '服务条款', '隐私政策',
  'technology', 'tech', 'industry', 'company', 'companies', 'market', 'solution', 'solutions', 'system', 'systems',
  'group', 'groups', 'inc', 'corp', 'ltd',
]);

/** Navigation/boilerplate phrases that disqualify a candidate even when they
 *  appear inside a longer CJK phrase ("阿里巴巴集团官方网站") or a multi-word
 *  filing-menu fragment ("Category DESCRIPTION DATE"). */
const NAVIGATION_SUBSTRINGS = [
  '官方网站', '官网', '首页', '关于我们', '联系我们', '公司简介', '投资者关系', '新闻中心',
  'investor relations', 'press release', 'press releases', 'about us', 'company profile',
];

/** Common/generic words: a multi-word phrase whose every word is in this set
 *  carries no research intent and is rejected. */
const GENERIC_WORDS = new Set([
  'and', 'or', 'the', 'of', 'for', 'to', 'on', 'with', 'by', 'in', 'into', 'from', 'at',
  'a', 'an', 'is', 'are', 'was', 'were', 'as', 'that', 'this', 'these', 'those', 'its', 'it', 'their',
  'category', 'description', 'date', 'download', 'listen', 'press', 'releases', 'release',
  'results', 'quarterly', 'overview', 'filings', 'filing', 'announcements', 'announcement',
  'continue', 'more', 'about', 'home', 'contact', 'products', 'product', 'services', 'service',
  'company', 'companies', 'investors', 'investor', 'relations', 'news', 'all', 'q&a',
  'group', 'groups', 'inc', 'corp', 'ltd', 'technology', 'tech', 'industry', 'market',
  'system', 'systems', 'solution', 'solutions', 'business', 'official', 'officialwebsite',
  'corporation', 'corporations', 'presentation', 'presentations', 'shareholder', 'shareholders',
  'deck', 'stock', 'financial', 'earnings',
]);

/** True when a candidate follow-up phrase is navigation noise or too generic
 *  to carry a research intent. A bare year is also rejected. */
export function isNavigationNoisePhrase(phrase: string): boolean {
  const trimmed = phrase.trim();
  if (trimmed.length < 2) return true;
  if (/^\d{4}$/.test(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  if (NOISE_PHRASES.has(lower.replace(/\s+/g, ''))) return true;
  if (NAVIGATION_SUBSTRINGS.some((sub) => lower.includes(sub))) return true;
  const words = trimmed
    .split(/[\s,，。;；、（）()\[\]【】"'“”‘’《》|/—\-–…?:：!.!]+/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  if (words.length >= 2 && words.every((word) => GENERIC_WORDS.has(word))) return true;
  return false;
}

function scopeNameFor(lead: WebResearchLead, scopeNames: Map<string, ResearchCampaignTask>): ResearchCampaignTask | null {
  const exact = scopeNames.get(scopeKey(lead.topic_id, lead.branch_id ?? null));
  if (exact) return exact;
  return scopeNames.get(scopeKey(lead.topic_id, null)) ?? null;
}

/** Builds scoped follow-up queries from a lead. Primary: the longest
 *  meaningful title part. Secondary (only when budget allows): the most
 *  specific keyphrase carved out of the snippet — a general lead often hides
 *  its real angle in the snippet (an electrode material, a therapy field, a
 *  company name), which is exactly the "举一反三" divergence the deep sweep
 *  exists for. Both remain context-only research leads downstream. */
function followupsForLead(lead: WebResearchLead, scope: ResearchCampaignTask | null, knownQueries: Set<string>, picked: Set<string>, remaining: number): DeepResearchPlannedQuery[] {
  const title = lead.title.trim();
  if (!title || title.length < 6) return [];
  const scopeZh = scope?.display_name_zh ?? '';
  const scopeEn = scope?.display_name_en ?? '';
  // Skip leads that merely restate the topic/branch name.
  const titleNorm = title.toLowerCase().replace(/\s+/g, '');
  if ((scopeZh && titleNorm === scopeZh.toLowerCase()) || (scopeEn && titleNorm === scopeEn.toLowerCase())) return [];
  const cjk = /[\u4e00-\u9fff]/.test(title);
  const scopeName = cjk ? scopeZh : (scopeEn ?? '');
  // Prefer the longest meaningful title part as the deep-search keyphrase.
  // Navigation parts ("Relations", "关于我们", ...) are filtered out up front,
  // so a navigation-style title still yields its entity ("NVIDIA") instead of
  // a boilerplate word.
  const parts = title.split(PART_DELIMITERS).map((p) => p.trim()).filter((p) => p.length >= 2 && !isNavigationNoisePhrase(p));
  const keyphrase = parts.length > 1 ? parts.slice().sort((a, b) => b.length - a.length)[0] : (parts[0] ?? null);
  const primary = keyphrase && keyphrase.length >= 4 && keyphrase.toLowerCase() !== scopeName.toLowerCase()
    ? keyphrase.slice(0, 60)
    : null;
  const out: DeepResearchPlannedQuery[] = [];
  const push = (query: string): void => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 4 || isNavigationNoisePhrase(query) || knownQueries.has(normalized) || picked.has(normalized)) return;
    picked.add(normalized);
    out.push({
      query: query.trim(),
      topic_id: lead.topic_id,
      branch_id: lead.branch_id ?? null,
      candidate_node_id: lead.candidate_node_id ?? null,
      campaign_task_id: scope?.task_id ?? '',
      source_ids: scope?.source_ids ?? [],
      source_domains: scope?.source_domains ?? [],
      // Follow-up research keeps Atlas domains as a hint only. A new angle
      // may be corroborated by a different official or company primary host.
      strict_source_domains: [],
    });
  };
  if (primary) push(primary);
  if (out.length < remaining) {
    const snippetPhrase = snippetKeyphrase(lead.snippet, scopeZh, scopeEn, title);
    if (snippetPhrase) push(snippetPhrase);
  }
  return out;
}

/** Carves the single most specific searchable keyphrase out of a snippet: the
 *  longest CJK run (4+ chars) or the longest English 2-3 word phrase. Skips
 *  candidates that restate the scope name or already appear in the title
 *  (those are covered by the primary query). */
function snippetKeyphrase(snippet: string | null | undefined, scopeZh: string, scopeEn: string, title: string): string | null {
  const text = (snippet ?? '').trim();
  if (!text) return null;
  const candidates: string[] = [];
  for (const run of text.match(/[\u4e00-\u9fff]{4,12}/g) ?? []) {
    if (!isNavigationNoisePhrase(run)) candidates.push(run);
  }
  for (const phrase of text.match(/[A-Za-z][A-Za-z0-9&'-]*(?: [A-Za-z][A-Za-z0-9&'-]*){1,2}/g) ?? []) {
    const trimmed = phrase.trim();
    if (trimmed.length >= 6 && !isNavigationNoisePhrase(trimmed)) candidates.push(trimmed);
  }
  if (!candidates.length) return null;
  const titleNorm = title.toLowerCase().replace(/\s+/g, '');
  const scopeZhKey = scopeZh.toLowerCase().replace(/\s+/g, '');
  const scopeEnKey = scopeEn.toLowerCase().replace(/\s+/g, '');
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    if (titleNorm.includes(key) || key === scopeZhKey || key === scopeEnKey) continue;
    unique.push(candidate);
  }
  if (!unique.length) return null;
  return unique.sort((a, b) => b.length - a.length)[0].slice(0, 60);
}

export interface DeriveFollowupQueriesInput {
  leads: WebResearchLead[];
  scopeNames: Map<string, ResearchCampaignTask>;
  knownQueries: Set<string>;
  budget: number;
}

/** Derives the next round of follow-up queries from the prior round's leads,
 *  bounded by `budget`. Stops naturally: when no lead yields a new angle the
 *  result is empty and the sweep halts without running another round. */
export function deriveFollowupQueries(input: DeriveFollowupQueriesInput): DeepResearchPlannedQuery[] {
  const picked = new Set<string>();
  const out: DeepResearchPlannedQuery[] = [];
  for (const lead of input.leads) {
    if (out.length >= input.budget) break;
    const remaining = input.budget - out.length;
    for (const query of followupsForLead(lead, scopeNameFor(lead, input.scopeNames), input.knownQueries, picked, remaining)) {
      if (out.length >= input.budget) break;
      out.push(query);
    }
  }
  return out;
}
