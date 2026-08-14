import type { DirectSourceResearchLead, DirectSourceResearchQuery, DirectSourceResearchReport } from '@/features/research/types/direct_source_research';
import type { AuthoritativeResearchSource, AuthoritativeSourceAtlas, ResearchCampaign } from '@/features/research/types/research_coverage';
import { directSourceQuery, matchesCampaignTerms } from '@/features/research/domain/direct_source_research';

export interface RunDirectSourceResearchUseCaseDeps {
  now(): string;
  producerVersion(): string;
  readSourceAtlas(): AuthoritativeSourceAtlas;
  supports(source: AuthoritativeResearchSource): boolean;
  search(input: { source: AuthoritativeResearchSource; task: ResearchCampaign['tasks'][number]; maxResults: number; timeoutMs: number }): Promise<Array<{ title: string; url: string; snippet: string; published_at: string | null; term_match_verified?: boolean }>>;
  writeReport(report: DirectSourceResearchReport): void;
  validateReport(report: DirectSourceResearchReport): void;
}

/** Queries only term-addressable, polling-permitted primary APIs for a campaign. */
export class RunDirectSourceResearchUseCase {
  constructor(private readonly deps: RunDirectSourceResearchUseCaseDeps) {}

  async execute(input: { campaign: ResearchCampaign; maxTasks?: number; maxQueries?: number; maxResults?: number; timeoutMs?: number } ): Promise<DirectSourceResearchReport> {
    const generatedAt = this.deps.now();
    const sources = new Map(this.deps.readSourceAtlas().sources.map((source) => [source.source_id, source]));
    const queries: DirectSourceResearchQuery[] = [];
    const leads: DirectSourceResearchLead[] = [];
    const maxResults = input.maxResults ?? 5;
    const maxQueries = input.maxQueries ?? 8;
    let executedQueries = 0;

    const plans = balancedDirectTasks(input.campaign.tasks, sources, this.deps.supports, input.maxTasks ?? 12).map((task) => {
      const queryable: AuthoritativeResearchSource[] = [];
      for (const sourceId of task.source_ids) {
        const source = sources.get(sourceId);
        if (!source || source.access_mode !== 'direct_api') continue;
        // A catalogued static API may be authoritative but still unable to
        // accept this task's term. It belongs in the capability catalog, not
        // in this run's query log as a misleading skipped "failure".
        if (!this.deps.supports(source)) continue;
        queryable.push(source);
      }
      return { task, sources: queryable };
    });

    // One source per task per pass prevents a well-covered parent Topic from
    // consuming the whole budget before research seeds or independent branches
    // receive their first source check.
    for (let sourceIndex = 0; executedQueries < maxQueries; sourceIndex += 1) {
      let hasNextSource = false;
      for (const plan of plans) {
        const source = plan.sources[sourceIndex];
        if (!source) continue;
        hasNextSource = true;
        const task = plan.task;
        const sourceId = source.source_id;
        const queryId = `direct_query_${task.task_id}_${sourceId}`.slice(0, 180);
        const query = directSourceQuery(source, task);
        try {
          executedQueries += 1;
          const rows = await this.deps.search({ source, task, maxResults, timeoutMs: input.timeoutMs ?? 15_000 });
          const validRows = rows.filter((row) => Boolean(row.title && row.url)
            && !isFutureRecord(row.published_at, generatedAt)
            // A provider full-text hit can be broad or stale. General sources
            // must name the concept in their title. A filing may use a compact
            // form title, but then it must name a tracked US company and repeat
            // the concept in its visible filing description.
            && hasVisibleConceptContext({ task, sourceId, title: row.title, snippet: row.snippet })
            && !hasTradingAdvice(`${row.title} ${row.snippet}`));
          queries.push({ query_id: queryId, task_id: task.task_id, source_id: sourceId, source_name: source.display_name_zh, query, status: 'completed', result_count: validRows.length, error: null });
          for (const [index, row] of validRows.entries()) {
            leads.push({
              lead_id: `${queryId}_${index + 1}`,
              task_id: task.task_id,
              topic_id: task.topic_id,
              branch_id: task.branch_id,
              candidate_node_id: task.candidate_node_id,
              source_id: sourceId,
              source_name: source.display_name_zh,
              title: row.title,
              url: row.url,
              snippet: row.snippet,
              published_at: row.published_at,
              evidence_eligibility: task.evidence_eligibility ?? 'context_only',
              next_action: 'review_source',
            });
          }
        } catch (error) {
          queries.push({ query_id: queryId, task_id: task.task_id, source_id: sourceId, source_name: source.display_name_zh, query, status: 'failed', result_count: 0, error: safeError(error) });
        }
        if (executedQueries >= maxQueries) break;
      }
      if (!hasNextSource) break;
    }

    const report: DirectSourceResearchReport = {
      artifact_type: 'direct_source_research_report',
      schema_version: '1.0.0',
      producer_version: this.deps.producerVersion(),
      research_id: `direct_source_research_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
      generated_at: generatedAt,
      status: queries.length === 0 ? 'insufficient_coverage' : queries.some((query) => query.status === 'failed') ? 'degraded' : 'completed',
      queries,
      lead_count: leads.length,
      leads: dedupe(leads),
      guardrail_check: {
        direct_source_results_not_formal_evidence: true,
        original_source_url_required: true,
        evidence_table_required_for_stage: true,
        parent_branch_separation: true,
        no_auto_import: true,
        no_trading_advice: true,
      },
    };
    report.lead_count = report.leads.length;
    this.deps.validateReport(report);
    this.deps.writeReport(report);
    return report;
  }
}

function balancedDirectTasks(
  tasks: ResearchCampaign['tasks'],
  sources: Map<string, AuthoritativeResearchSource>,
  supports: (source: AuthoritativeResearchSource) => boolean,
  maxTasks: number,
): ResearchCampaign['tasks'] {
  const queues = new Map<string, ResearchCampaign['tasks']>();
  for (const task of tasks) {
    const hasQueryableSource = task.source_ids.some((sourceId) => {
      const source = sources.get(sourceId);
      return Boolean(source && source.access_mode === 'direct_api' && supports(source));
    });
    if (!hasQueryableSource) continue;
    const queue = queues.get(task.domain) ?? [];
    queue.push(task);
    queues.set(task.domain, queue);
  }
  for (const queue of queues.values()) {
    queue.sort((left, right) => directTaskPriority(left) - directTaskPriority(right) || right.priority - left.priority || left.task_id.localeCompare(right.task_id));
  }
  const domains = [...queues.keys()].sort((left, right) => {
    const leftPriority = queues.get(left)?.[0]?.priority ?? 0;
    const rightPriority = queues.get(right)?.[0]?.priority ?? 0;
    return rightPriority - leftPriority || left.localeCompare(right);
  });
  const selected: ResearchCampaign['tasks'] = [];
  const selectedIds = new Set<string>();
  const reserve = (kind: ResearchCampaign['tasks'][number]['node_kind']) => {
    const candidate = [...queues.values()]
      .flat()
      .filter((task) => task.node_kind === kind)
      .sort((left, right) => right.priority - left.priority || left.task_id.localeCompare(right.task_id))[0];
    if (!candidate || selected.length >= maxTasks || selectedIds.has(candidate.task_id)) return;
    selected.push(candidate);
    selectedIds.add(candidate.task_id);
    const queue = queues.get(candidate.domain);
    if (queue) queue.splice(queue.findIndex((task) => task.task_id === candidate.task_id), 1);
  };
  // A normal direct-source window must exercise the same three governed
  // scopes as web discovery. It does not imply that every API will return a
  // valid row, only that the scope received a real query opportunity.
  if (maxTasks >= 3) {
    reserve('formal_topic');
    reserve('branch');
    reserve('universe_seed');
  } else {
    reserve('formal_topic');
  }
  // Continue from the domain after the final reservation. This preserves the
  // earlier cross-domain round robin even when a formal parent was reserved.
  let cursor = selected.length
    ? (domains.indexOf(selected[selected.length - 1]!.domain) + 1) % Math.max(1, domains.length)
    : 0;
  let emptyChecks = 0;
  while (selected.length < maxTasks && emptyChecks < domains.length) {
    const domain = domains[cursor]!;
    cursor = (cursor + 1) % Math.max(1, domains.length);
    const task = queues.get(domain)?.shift();
    if (!task || selectedIds.has(task.task_id)) {
      emptyChecks += 1;
      continue;
    }
    selected.push(task);
    selectedIds.add(task.task_id);
    emptyChecks = 0;
  }
  return selected;
}

function directTaskPriority(task: ResearchCampaign['tasks'][number]): number {
  if (task.deep_probe_target) return -1;
  if (task.node_kind === 'formal_topic') return 0;
  if (task.node_kind === 'universe_seed') return 1;
  if (task.node_kind === 'provisional_topic') return 2;
  return 3;
}

function dedupe(leads: DirectSourceResearchLead[]): DirectSourceResearchLead[] {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    const key = `${lead.task_id}|${lead.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasTradingAdvice(value: string): boolean {
  return /\b(?:buy|sell|long|short)\b|买入|卖出|建仓|目标价|仓位/i.test(value);
}

function hasVisibleConceptContext(input: {
  task: ResearchCampaign['tasks'][number];
  sourceId: string;
  title: string;
  snippet: string;
}): boolean {
  if (matchesCampaignTerms(input.task, input.title)) return true;
  if (input.sourceId !== 'sec_edgar' || !matchesCampaignTerms(input.task, input.snippet)) return false;
  const normalizedTitle = normalize(input.title);
  return (input.task.company_targets ?? [])
    .filter((company) => company.market === 'us')
    .some((company) => normalizedTitle.includes(normalize(company.display_name_en)));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

function isFutureRecord(value: string | null, generatedAt: string): boolean {
  if (!value) return false;
  const record = Date.parse(value);
  const generated = Date.parse(generatedAt);
  return Number.isFinite(record) && Number.isFinite(generated) && record > generated;
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/(api[_-]?key|authorization|token|secret)\s*[=:]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 240);
}
