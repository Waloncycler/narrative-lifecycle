import type { ResearchCampaign } from '../../types/research_coverage';
import type { WebResearchReport } from '../../types/web_research';
import type { DirectSourceResearchReport } from '../../types/direct_source_research';
import type { EvidenceIntakeSession } from '../../types/intake';
import type { ResearchLeadTriageReport } from '../../types/research_lead_triage';
import type { ResearchSourceRetrievalReport } from '../../types/research_source_retrieval';

export interface RunResearchCampaignUseCaseDeps {
  buildCampaign(input: { maxTasks?: number }): ResearchCampaign;
  runWebResearch(input: {
    plannedQueries: Array<{ query: string; topic_id: string | null; branch_id: string | null; candidate_node_id?: string | null; campaign_task_id: string; source_ids: string[]; source_domains: string[] }>;
  }): Promise<WebResearchReport>;
  runDirectSourceResearch(input: { campaign: ResearchCampaign; maxTasks: number; maxQueries: number }): Promise<DirectSourceResearchReport>;
  prepareDirectSourceIntake(report: DirectSourceResearchReport): EvidenceIntakeSession | null;
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

  async execute(input: { maxTasks?: number; maxQueries?: number; maxDirectQueries?: number } = {}): Promise<{ campaign: ResearchCampaign; webResearch: WebResearchReport; directSourceResearch: DirectSourceResearchReport; directSourceSession: EvidenceIntakeSession | null; leadTriage: ResearchLeadTriageReport | null; sourceRetrieval: ResearchSourceRetrievalReport | null }> {
    const campaign = this.deps.buildCampaign({ maxTasks: input.maxTasks });
    const plannedQueries = buildPlannedQueries(campaign, input.maxQueries ?? 12);
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
    return { campaign, webResearch, directSourceResearch, directSourceSession, leadTriage, sourceRetrieval };
  }
}

/** Reserve a bounded share of web discovery for official company/IR pages.
 * Company results remain context-only and retain their originating parent or
 * branch scope; they are never used to raise a Topic automatically.
 * Topic queries, by contrast, are a wide-net discovery pass: they must not
 * inherit the task's authoritative-domain whitelist, or the keyless free
 * aggregate (Wikipedia/arXiv/OpenAlex/news...) would be filtered to zero.
 * Domain-targeted retrieval is handled by direct source research instead. */
function buildPlannedQueries(campaign: ResearchCampaign, maxQueries: number): Array<{
  query: string;
  topic_id: string | null;
  branch_id: string | null;
  candidate_node_id?: string | null;
  campaign_task_id: string;
  source_ids: string[];
  source_domains: string[];
}> {
  const companyBudget = Math.min(
    Math.max(1, Math.floor(maxQueries / 3)),
    campaign.tasks.flatMap((task) => task.company_targets ?? []).length,
  );
  const topicBudget = Math.max(0, maxQueries - companyBudget);
  const topicQueries = balancedWebTasks(campaign.tasks, topicBudget).map((task) => ({
      // Wide-net pass uses the English term when available: free sources
      // (HN/OpenAlex/GDELT/DDG/Wikipedia) index primarily English, and a
      // mixed zh+en query starves every keyless source except arXiv's loose
      // matcher. Wikipedia zh still resolves via cross-language redirects.
      query: (task.display_name_en ?? task.display_name_zh).trim().slice(0, 280),
      topic_id: task.topic_id,
      branch_id: task.branch_id,
      candidate_node_id: task.candidate_node_id,
      campaign_task_id: task.task_id,
      source_ids: [],
      source_domains: [],
  }));
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
        query: `${company.display_name_zh} ${company.display_name_en} ${task.display_name_zh} ${task.display_name_en ?? ''} official investor relations filing`.trim().slice(0, 280),
        topic_id: task.topic_id,
        branch_id: task.branch_id,
        candidate_node_id: task.candidate_node_id,
        campaign_task_id: `${task.task_id}__company_${company.company_id}`.slice(0, 180),
        source_ids: company.disclosure_source_ids,
        source_domains: [sourceDomain],
      }];
    });
  return [...topicQueries, ...companyQueries].slice(0, maxQueries);
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
