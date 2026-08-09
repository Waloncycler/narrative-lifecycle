import type { ResearchCampaign } from '@/features/research/types/research_coverage';
import type { AliasRecord, TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { WebResearchReport } from '@/features/research/types/web_research';
import type { DirectSourceResearchReport } from '@/features/research/types/direct_source_research';
import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';

export interface RunResearchCampaignUseCaseDeps {
  /** Optional Alias Registry access. When present, topic queries expand into
   *  the registry aliases/abbreviations (EN/ZH/BCI...) via round-robin;
   *  without it the campaign falls back to the task's own display names. */
  readRegistry?(): TopicRegistry;
  buildCampaign(input: { maxTasks?: number }): ResearchCampaign;
  runWebResearch(input: {
    plannedQueries: Array<{ query: string; topic_id: string | null; branch_id: string | null; candidate_node_id?: string | null; campaign_task_id: string; source_ids: string[]; source_domains: string[]; strict_source_domains?: string[] }>;
  }): Promise<WebResearchReport>;
  runDirectSourceResearch(input: { campaign: ResearchCampaign; maxTasks: number; maxQueries: number }): Promise<DirectSourceResearchReport>;
  prepareDirectSourceIntake(report: DirectSourceResearchReport): EvidenceIntakeSession | null;
  /** Appends citation-ready original-page excerpts to the just-created direct
   * source session, retaining original source/date metadata when URLs match. */
  appendRetrievedSourceIntake?(report: ResearchSourceRetrievalReport): EvidenceIntakeSession | null;
  /** Optional during the compatibility migration. When present it consumes
   * only the reports just persisted by the two research adapters. */
  buildLeadTriage?(): ResearchLeadTriageReport;
  /** Bounded original-page retrieval is optional for compatibility. It reads
   * only the just-written triage queue and remains context-only. */
  retrieveSources?(): Promise<ResearchSourceRetrievalReport>;
}

/** Runs a bounded campaign through the existing context-only web discovery gate. */
export class RunResearchCampaignUseCase {
  constructor(private readonly deps: RunResearchCampaignUseCaseDeps) {}

  async execute(input: { maxTasks?: number; maxQueries?: number; maxDirectQueries?: number } = {}): Promise<{ campaign: ResearchCampaign; webResearch: WebResearchReport; directSourceResearch: DirectSourceResearchReport; directSourceSession: EvidenceIntakeSession | null; sourceRetrievalSession: EvidenceIntakeSession | null; leadTriage: ResearchLeadTriageReport | null; sourceRetrieval: ResearchSourceRetrievalReport | null }> {
    const campaign = this.deps.buildCampaign({ maxTasks: input.maxTasks });
    const aliases = this.deps.readRegistry?.()?.aliases ?? [];
    const plannedQueries = buildPlannedQueries(campaign, input.maxQueries ?? 12, aliases);
    const [webResearch, directSourceResearch] = await Promise.all([
      this.deps.runWebResearch({ plannedQueries }),
      this.deps.runDirectSourceResearch({
        campaign,
        maxTasks: input.maxTasks ?? campaign.tasks.length,
        maxQueries: input.maxDirectQueries ?? 8,
      }),
    ]);
    const directSourceSession = this.deps.prepareDirectSourceIntake(directSourceResearch);
    // The triage queue is a read-only classification of persisted search
    // artifacts. It cannot create Evidence or write a lifecycle state.
    const leadTriage = this.deps.buildLeadTriage?.() ?? null;
    const sourceRetrieval = leadTriage ? await this.deps.retrieveSources?.() ?? null : null;
    const sourceRetrievalSession = sourceRetrieval ? this.deps.appendRetrievedSourceIntake?.(sourceRetrieval) ?? directSourceSession : directSourceSession;
    return { campaign, webResearch, directSourceResearch, directSourceSession, sourceRetrievalSession, leadTriage, sourceRetrieval };
  }
}

/** Reserve a bounded share of web discovery for official company/IR pages.
 * Company results remain context-only and retain their originating parent or
 * branch scope; they are never used to raise a Topic automatically.
 * Topic queries, by contrast, are a wide-net discovery pass: they must not
 * inherit the task's authoritative-domain whitelist, or the keyless free
 * aggregate (Wikipedia/arXiv/OpenAlex/news...) would be filtered to zero.
 * Domain-targeted retrieval is handled by direct source research instead.
 * Every topic query is a single-intent term (never a mixed zh+en keyword-
 * stuffed string): scope coverage first, alias expansion second. */
function buildPlannedQueries(campaign: ResearchCampaign, maxQueries: number, aliases: AliasRecord[] = []): PlannedWebQuery[] {
  const companyBudget = Math.min(
    Math.max(1, Math.floor(maxQueries / 3)),
    campaign.tasks.flatMap((task) => task.company_targets ?? []).length,
  );
  const topicBudget = Math.max(0, maxQueries - companyBudget);
  // Scope coverage first, but a slice of the budget must stay available for
  // ZH/alias variants — otherwise a large task registry eats the whole budget
  // with one English query per scope and the Chinese/abbreviation 口径 is
  // never searched. Cap the distinct-scope pass (never below the three
  // governed minimum slots) and round-robin the remaining slots across the
  // selected tasks' term variants.
  const scopeCap = Math.max(3, Math.ceil(topicBudget * 0.6));
  const topicQueries = plannedTopicQueries(balancedWebTasks(campaign.tasks, Math.min(topicBudget, scopeCap)), topicBudget, aliases);
  const seenCompanyTasks = new Set<string>();
  const companyQueries = campaign.tasks
    .flatMap((task) => (task.company_targets ?? []).map((company) => ({ task, company })))
    .filter(({ task, company }) => {
      const key = `${task.topic_id ?? task.candidate_node_id ?? 'unresolved'}:${task.branch_id ?? 'parent'}:${company.company_id}`;
      if (seenCompanyTasks.has(key)) return false;
      seenCompanyTasks.add(key);
      return true;
    })
    .slice(0, companyBudget)
    .flatMap(({ task, company }) => {
      const sourceDomain = hostFor(company.official_source_url);
      if (!sourceDomain) return [];
      return [{
        // Company Query Slimming: one bounded intent per query. The default
        // IR pass uses the English name alone; stuffing zh+en+topic+official
        // into one string only hits the homepage or navigation pages.
        query: `${company.display_name_en || company.display_name_zh} investor relations`.trim().slice(0, 280),
        topic_id: task.topic_id,
        branch_id: task.branch_id,
        candidate_node_id: task.candidate_node_id,
        campaign_task_id: `${task.task_id}__company_${company.company_id}`.slice(0, 180),
        source_ids: company.disclosure_source_ids,
        source_domains: [sourceDomain],
        strict_source_domains: [sourceDomain],
      }];
    });
  return [...topicQueries, ...companyQueries].slice(0, maxQueries);
}

interface PlannedWebQuery {
  query: string;
  topic_id: string | null;
  branch_id: string | null;
  candidate_node_id?: string | null;
  campaign_task_id: string;
  source_ids: string[];
  source_domains: string[];
  strict_source_domains?: string[];
}

/** Round-robin topic term expansion. Each selected task contributes a queue
 *  of distinct search terms — English name first (the free wide-net sources
 *  index primarily English), then the Chinese name, then every registry
 *  alias/abbreviation for its topic — and budget slots are filled across
 *  tasks round by round. Scope coverage (parent/branch/seed) therefore always
 *  precedes alias coverage: Round 1 is the primary term per scope, Round 2
 *  the Chinese term, Round 3+ the aliases. One query per intent. */
function plannedTopicQueries(tasks: ResearchCampaign['tasks'], budget: number, aliases: AliasRecord[]): PlannedWebQuery[] {
  const queues = tasks.map((task) => ({ task, terms: taskSearchTerms(task, aliases) }));
  const out: PlannedWebQuery[] = [];
  for (let round = 0; out.length < budget; round += 1) {
    let added = false;
    for (const { task, terms } of queues) {
      if (out.length >= budget) break;
      const term = terms[round];
      if (!term) continue;
      out.push({
        query: term.slice(0, 280),
        topic_id: task.topic_id,
        branch_id: task.branch_id,
        candidate_node_id: task.candidate_node_id,
        campaign_task_id: task.task_id,
        source_ids: task.source_ids,
        source_domains: task.source_domains,
        // Source Atlas domains remain a search hint, but wide Topic/Branch
        // discovery must not discard a valid corroborating result merely
        // because it was published on another governed domain.
        strict_source_domains: [],
      });
      added = true;
    }
    if (!added) break;
  }
  return out;
}

/** Distinct searchable terms for one campaign task: the English display name,
 *  the Chinese display name, then every registry alias/abbreviation registered
 *  for the task's topic (branches inherit their parent topic's aliases;
 *  universe seeds and provisional topics have none). */
function taskSearchTerms(task: ResearchCampaign['tasks'][number], aliases: AliasRecord[]): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();
  const add = (term: string | null | undefined): void => {
    const normalized = term?.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) return;
    seen.add(normalized.toLowerCase());
    terms.push(normalized);
  };
  add(task.display_name_en);
  add(task.display_name_zh);
  if (task.topic_id) {
    for (const alias of aliases.filter((item) => item.topic_id === task.topic_id)) add(alias.alias);
  }
  return terms;
}

/** A fixed query budget must not silently become an existing-topic-only
 * budget. With three or more slots, reserve one each for a formal Topic, a
 * Branch, and a research seed, then rotate the remaining slots by node kind.
 * This is discovery coverage only; selected tasks still produce context-only
 * leads and preserve their original scope. */
function balancedWebTasks(tasks: ResearchCampaign['tasks'], limit: number): ResearchCampaign['tasks'] {
  if (limit < 1) return [];
  const order: ResearchCampaign['tasks'][number]['node_kind'][] = ['formal_topic', 'branch', 'universe_seed', 'provisional_topic'];
  const queues = new Map(order.map((kind) => [kind, tasks.filter((task) => task.node_kind === kind)]));
  const selected: ResearchCampaign['tasks'] = [];
  const selectOne = (kind: ResearchCampaign['tasks'][number]['node_kind']) => {
    const task = queues.get(kind)?.shift();
    if (task) selected.push(task);
  };

  // A one- or two-slot run cannot guarantee all scopes. A normal campaign
  // gets the three required coverage lanes before it fills remaining slots.
  if (limit >= 3) {
    selectOne('formal_topic');
    selectOne('branch');
    selectOne('universe_seed');
  } else {
    selectOne('formal_topic');
  }
  while (selected.length < limit) {
    let added = false;
    for (const kind of order) {
      if (selected.length >= limit) break;
      const before = selected.length;
      selectOne(kind);
      added = added || selected.length > before;
    }
    if (!added) break;
  }
  return selected;
}

function hostFor(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}
