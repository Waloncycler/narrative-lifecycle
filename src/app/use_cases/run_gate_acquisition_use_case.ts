import { buildEvidenceGateCoverage, type AcquisitionTask, type GateCoverageReport } from '@/features/research/domain/evidence_gate_coverage';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { IntakeAgentReviewBundle } from '@/features/intake/types/intake_agent';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { AutonomousResearchRun } from '@/features/research/types/autonomous_research';
import type { ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';
import type { WebResearchReport } from '@/features/research/types/web_research';
import type { AuthoritativeSourceAtlas, CompanyResearchRegistry } from '@/features/research/types/research_coverage';
import { buildGateAcquisitionQueries } from '@/features/research/domain/gate_source_strategy';

export interface GateAcquisitionReport {
  artifact_type: 'gate_acquisition_report';
  schema_version: '1.0.0';
  generated_at: string;
  status: 'completed' | 'degraded' | 'unconfigured';
  selected_task_count: number;
  query_count: number;
  search_lead_count: number;
  retrieved_count: number;
  citation_ready_count: number;
  intake_candidate_count: number;
  published_evidence_count: number;
  minimax_used: boolean;
  acquisition_queries: PlannedQuery[];
  source_coverage: {
    atlas_source_count: number;
    targeted_source_ids: string[];
    targeted_source_domains: string[];
    discovered_source_domains: string[];
    citation_ready_source_domains: string[];
    avoided_existing_source_domains: string[];
  };
  selected_tasks: AcquisitionTask[];
  coverage: GateCoverageReport;
  guardrail_check: {
    search_results_context_only: true;
    evidence_table_required: true;
    stage_first_score_second: true;
    parent_branch_separation: true;
    no_trading_advice: true;
  };
}

export interface RunGateAcquisitionUseCaseDeps {
  now(): string;
  readRegistry(): TopicRegistry;
  readOperationalEvidence(): EvidenceNode[];
  readSourceAtlas(): AuthoritativeSourceAtlas;
  readCompanyRegistry(): CompanyResearchRegistry;
  runSearch(input: { plannedQueries: PlannedQuery[] }): Promise<WebResearchReport>;
  buildTriage(input: { webResearch: WebResearchReport }): ResearchLeadTriageReport;
  retrieve(input: { maxItems: number; maxUnknownDiscoveryItems: number; triage: ResearchLeadTriageReport }): Promise<ResearchSourceRetrievalReport>;
  appendIntake(report: ResearchSourceRetrievalReport): EvidenceIntakeSession | null;
  runAgent(): Promise<IntakeAgentReviewBundle>;
  publish(bundle: IntakeAgentReviewBundle): AutonomousResearchRun;
  writeReport(report: GateAcquisitionReport): void;
}

interface PlannedQuery {
  query: string;
  topic_id: string | null;
  branch_id: string | null;
  campaign_task_id: string;
  source_ids: string[];
  source_domains: string[];
  strict_source_domains?: string[];
}

/** Executes the ranked gate worklist through the existing governed intake
 * chain. Search snippets remain context-only; only retrieved citations can
 * reach the Agent and admission policy. */
export class RunGateAcquisitionUseCase {
  constructor(private readonly deps: RunGateAcquisitionUseCaseDeps) {}

  async execute(input: { maxTasks?: number; queriesPerTask?: number; maxRetrieved?: number } = {}): Promise<GateAcquisitionReport> {
    const generatedAt = this.deps.now();
    const registry = this.deps.readRegistry();
    const evidence = this.deps.readOperationalEvidence();
    const coverage = buildEvidenceGateCoverage({
      topics: registry.canonical_topics
        // Gate acquisition repairs the live dashboard. Provisional discovery
        // has a separate activation policy and cannot consume this budget or
        // inherit an active Topic's stage.
        .filter((topic) => topic.status === 'active')
        .map((topic) => ({
        topic_id: topic.topic_id,
        topic_name: topic.topic_name,
        current_stage: topic.current_stage,
        status: topic.status,
        })),
      evidence,
      asOf: generatedAt,
      generatedAt,
      // Empty active topics are the highest-value acquisition targets. They
      // must not disappear merely because their parent Evidence Table is empty.
      onlyWithEvidence: false,
    });
    const tasks = coverage.acquisition_worklist.slice(0, Math.max(1, input.maxTasks ?? 8));
    const atlas = this.deps.readSourceAtlas();
    const companies = this.deps.readCompanyRegistry();
    const plannedQueries = tasks.flatMap((task, taskIndex) => queriesFor(task, atlas, companies, taskIndex, input.queriesPerTask ?? 4));
    const search = await this.deps.runSearch({ plannedQueries });
    const triage = this.deps.buildTriage({ webResearch: search });
    const retrieval = await this.deps.retrieve({
      maxItems: Math.max(1, input.maxRetrieved ?? tasks.length * 3),
      maxUnknownDiscoveryItems: Math.min(2, tasks.length),
      triage,
    });
    const session = this.deps.appendIntake(retrieval);
    let publishedEvidenceCount = 0;
    if (session && retrieval.items.some((item) => item.citation_status === 'ready' && item.next_action === 'prepare_intake')) {
      const bundle = await this.deps.runAgent();
      publishedEvidenceCount = this.deps.publish(bundle).report.published_count;
    }
    const minimaxUsed = search.providers.includes('minimax');
    const report: GateAcquisitionReport = {
      artifact_type: 'gate_acquisition_report',
      schema_version: '1.0.0',
      generated_at: generatedAt,
      status: search.status === 'unconfigured' ? 'unconfigured' : search.status === 'degraded' || retrieval.failed_count > 0 ? 'degraded' : 'completed',
      selected_task_count: tasks.length,
      query_count: plannedQueries.length,
      search_lead_count: search.lead_count,
      retrieved_count: retrieval.retrieved_count,
      citation_ready_count: retrieval.items.filter((item) => item.citation_status === 'ready').length,
      intake_candidate_count: session?.candidates.length ?? 0,
      published_evidence_count: publishedEvidenceCount,
      minimax_used: minimaxUsed,
      acquisition_queries: plannedQueries,
      source_coverage: {
        atlas_source_count: atlas.sources.length,
        targeted_source_ids: [...new Set(plannedQueries.flatMap((query) => query.source_ids))].sort(),
        targeted_source_domains: [...new Set(plannedQueries.flatMap((query) => query.source_domains))].sort(),
        discovered_source_domains: [...new Set((search.leads ?? []).map((lead) => lead.source_domain).filter(Boolean))].sort(),
        citation_ready_source_domains: [...new Set(retrieval.items
          .filter((item) => item.citation_status === 'ready')
          .map((item) => safeDomain(item.url))
          .filter((item): item is string => Boolean(item)))].sort(),
        avoided_existing_source_domains: [...new Set(tasks.flatMap((task) => task.existing_source_domains))].sort(),
      },
      selected_tasks: tasks,
      coverage,
      guardrail_check: {
        search_results_context_only: true,
        evidence_table_required: true,
        stage_first_score_second: true,
        parent_branch_separation: true,
        no_trading_advice: true,
      },
    };
    this.deps.writeReport(report);
    return report;
  }
}

function safeDomain(value: string): string | null {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

function queriesFor(task: AcquisitionTask, atlas: AuthoritativeSourceAtlas, companies: CompanyResearchRegistry, taskIndex: number, limit: number): PlannedQuery[] {
  return buildGateAcquisitionQueries({ task, atlas, companies, limit }).map((query, index) => ({
    query: query.query,
    topic_id: task.topic_id,
    branch_id: null,
    campaign_task_id: `gate_acquisition__${task.topic_id}__${task.gate}__${taskIndex}_${index}`,
    source_ids: query.source_ids,
    source_domains: query.source_domains,
    strict_source_domains: query.strict_source_domains,
  }));
}
