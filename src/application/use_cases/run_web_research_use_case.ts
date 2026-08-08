import { buildWebResearchQueries, deduplicateWebResearchLeads, normalizeWebResearchLeads } from '@/domain/web_research';
import type { TopicRegistry } from '@/types/topic_resolution';
import type { WebResearchReport, WebSearchConfig, WebSearchProvider } from '@/types/web_research';

export interface RunWebResearchUseCaseDeps {
  now(): string;
  producerVersion(): string;
  config(): WebSearchConfig;
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
    plannedQueries?: Array<{ query: string; topic_id: string | null; branch_id: string | null; candidate_node_id?: string | null; campaign_task_id: string; source_ids: string[]; source_domains: string[] }>;
    limit?: number;
  } = {}): Promise<WebResearchReport> {
    const generatedAt = this.deps.now();
    const config = this.deps.config();
    const queries = buildWebResearchQueries({ registry: this.deps.readRegistry(), ...input });
    const base = {
      artifact_type: 'web_research_report' as const,
      schema_version: '1.0.0' as const,
      producer_version: this.deps.producerVersion(),
      research_id: `web_research_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
      generated_at: generatedAt,
      provider: config.provider,
      queries,
      guardrail_check: {
        search_snippets_not_formal_evidence: true as const,
        evidence_table_required_for_stage: true as const,
        parent_branch_separation: true as const,
        no_auto_import: true as const,
        no_trading_advice: true as const,
      },
    };
    // Keyless providers (free, gdelt, wikipedia, hn, duckduckgo) work out of
    // the box; only keyed/self-hosted providers need credentials or an endpoint.
    const missingKey = (config.provider === 'brave' || config.provider === 'tavily') && !config.api_key;
    const missingEndpoint = config.provider === 'mcp_bridge' && !config.endpoint;
    if (config.provider === 'disabled' || missingKey || missingEndpoint) {
      const report: WebResearchReport = { ...base, status: 'unconfigured', lead_count: 0, leads: [], errors: ['web_search_provider_not_configured'] };
      this.deps.validateReport(report);
      this.deps.writeReport(report);
      return report;
    }

    const errors: string[] = [];
    // Run queries with a small concurrency cap: the keyless free aggregate
    // fans out to 8 upstream sources per query, and a full Promise.all over
    // many queries triggers rate limiting (sources return empty 200s).
    const results = await mapLimit(queries, 3, async (query) => {
      try {
        const rows = await this.deps.search({ query: query.query, config, sourceDomains: query.source_domains });
        return normalizeWebResearchLeads({ query, rows, retrievedAt: generatedAt, maxResults: config.max_results_per_query });
      } catch (error) {
        errors.push(`${query.query_id}: ${safeError(error)}`);
        return [];
      }
    });
    const leads = deduplicateWebResearchLeads(results.flat());
    const report: WebResearchReport = {
      ...base,
      status: errors.length ? 'degraded' : 'completed',
      lead_count: leads.length,
      leads,
      errors,
    };
    this.deps.validateReport(report);
    this.deps.writeReport(report);
    return report;
  }
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
