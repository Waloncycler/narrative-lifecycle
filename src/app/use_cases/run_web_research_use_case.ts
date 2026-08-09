import { buildWebResearchQueries, deduplicateWebResearchLeads, normalizeWebResearchLeads } from '@/features/research/domain/web_research';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { WebResearchProviderRun, WebResearchReport, WebSearchConfig, WebSearchProvider } from '@/features/research/types/web_research';

export interface RunWebResearchUseCaseDeps {
  now(): string;
  producerVersion(): string;
  /** Every search engine that should run on this pass. The use case fans out
   *  each query to all configs in parallel instead of picking one. */
  configs(): WebSearchConfig[];
  readRegistry(): TopicRegistry;
  search(input: { query: string; config: WebSearchConfig; sourceDomains?: string[] }): Promise<Array<{ title?: string; url?: string; snippet?: string; source_name?: string; published_at?: string | null }>>;
  writeReport(report: WebResearchReport): void;
  validateReport(report: WebResearchReport): void;
}

export class RunWebResearchUseCase {
  constructor(private readonly deps: RunWebResearchUseCaseDeps) {}

  async execute(input: {
    topicIds?: string[];
    queries?: string[];
    plannedQueries?: Array<{ query: string; topic_id: string | null; branch_id: string | null; candidate_node_id?: string | null; campaign_task_id: string; source_ids: string[]; source_domains: string[]; strict_source_domains?: string[] }>;
    limit?: number;
  } = {}): Promise<WebResearchReport> {
    const generatedAt = this.deps.now();
    const configs = this.deps.configs();
    const queries = buildWebResearchQueries({ registry: this.deps.readRegistry(), ...input });
    const base = {
      artifact_type: 'web_research_report' as const,
      schema_version: '1.0.0' as const,
      producer_version: this.deps.producerVersion(),
      research_id: `web_research_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
      generated_at: generatedAt,
      provider: (configs[0]?.provider ?? 'disabled') as WebSearchProvider,
      providers: configs.map((config) => config.provider),
      queries,
      guardrail_check: {
        search_snippets_not_formal_evidence: true as const,
        evidence_table_required_for_stage: true as const,
        parent_branch_separation: true as const,
        no_auto_import: true as const,
        no_trading_advice: true as const,
      },
    };
    // Keyless providers (free, gdelt, wikipedia, hn, duckduckgo, reddit,
    // arxiv, openalex, archive, bing) work out of the box; only keyed or
    // self-hosted providers need credentials or an endpoint. Engines that
    // cannot run are skipped, not treated as failures.
    const runnable = configs.filter((config) => {
      if (config.provider === 'disabled') return false;
      const missingKey = (config.provider === 'brave' || config.provider === 'tavily' || config.provider === 'minimax') && !config.api_key;
      const missingEndpoint = (config.provider === 'mcp_bridge' || config.provider === 'searxng') && !config.endpoint;
      return !missingKey && !missingEndpoint;
    });
    if (!runnable.length) {
      const report: WebResearchReport = { ...base, status: 'unconfigured', lead_count: 0, leads: [], errors: ['web_search_provider_not_configured'] };
      this.deps.validateReport(report);
      this.deps.writeReport(report);
      return report;
    }
    // The primary provider drives the report; every engine still contributes.
    base.provider = runnable[0]!.provider;
    base.providers = runnable.map((config) => config.provider);

    const errors: string[] = [];
    // Run queries with a small concurrency cap: the keyless free aggregate
    // fans out to 8 upstream sources per query, and a full Promise.all over
    // many queries triggers rate limiting (sources return empty 200s). Each
    // query fans out across every configured engine in parallel.
    const providerRuns = new Map<WebSearchProvider, WebResearchProviderRun>(runnable.map((config) => [config.provider, emptyProviderRun(config.provider)]));
    const results = await mapLimit(queries, 3, async (query) => {
      const perEngine = await Promise.all(runnable.map(async (config) => {
        const telemetry = providerRuns.get(config.provider)!;
        telemetry.query_count += 1;
        try {
          const rows = await this.deps.search({ query: query.query, config, sourceDomains: query.source_domains });
          telemetry.raw_result_count += rows.length;
          telemetry.successful_query_count += 1;
          if (!rows.length) telemetry.zero_result_query_count += 1;
          const normalized = normalizeWebResearchLeads({ query, rows, retrievedAt: generatedAt, maxResults: config.max_results_per_query });
          telemetry.normalized_lead_count += normalized.length;
          return normalized;
        } catch (error) {
          telemetry.error_count += 1;
          errors.push(`${query.query_id}[${config.provider}]: ${safeError(error)}`);
          return [];
        }
      }));
      return perEngine.flat();
    });
    const leads = deduplicateWebResearchLeads(results.flat());
    const report: WebResearchReport = {
      ...base,
      status: errors.length ? 'degraded' : 'completed',
      lead_count: leads.length,
      leads,
      errors,
      provider_runs: [...providerRuns.values()],
      source_yield: sourceYield(leads),
    };
    this.deps.validateReport(report);
    this.deps.writeReport(report);
    return report;
  }
}

function emptyProviderRun(provider: WebSearchProvider): WebResearchProviderRun {
  return { provider, query_count: 0, successful_query_count: 0, zero_result_query_count: 0, raw_result_count: 0, normalized_lead_count: 0, error_count: 0 };
}

function sourceYield(leads: WebResearchReport['leads']): NonNullable<WebResearchReport['source_yield']> {
  const counts = new Map<string, number>();
  for (const lead of leads) counts.set(lead.source_name, (counts.get(lead.source_name) ?? 0) + 1);
  return [...counts.entries()]
    .map(([source_name, lead_count]) => ({ source_name, lead_count }))
    .sort((left, right) => right.lead_count - left.lead_count || left.source_name.localeCompare(right.source_name));
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/(api[_-]?key|authorization|token|secret)\s*[=:]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 280);
}

/** Applies a bounded concurrency limit so free search sources are not
 *  overwhelmed by bursts of parallel queries. */
async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current] as T);
    }
  });
  await Promise.all(workers);
  return results;
}
