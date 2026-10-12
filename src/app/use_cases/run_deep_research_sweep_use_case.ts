import type { ResearchCampaign } from '@/features/research/types/research_coverage';
import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';
import type { WebResearchReport } from '@/features/research/types/web_research';
import type { DirectSourceResearchReport } from '@/features/research/types/direct_source_research';
import type { DeepResearchSweep, DeepResearchSweepInput, DeepResearchSweepRound } from '@/features/research/types/deep_research_sweep';
import { buildScopeNames, deriveFollowupQueries, type DeepResearchPlannedQuery } from '@/features/research/domain/deep_research';

export interface RunDeepResearchSweepUseCaseDeps {
  now(): string;
  producerVersion(): string;
  /** Round 0: the standard source-aware campaign pass (web + direct sources). */
  runCampaign(input: { maxTasks?: number; maxQueries?: number; maxDirectQueries?: number }): Promise<{
    campaign: ResearchCampaign;
    webResearch: WebResearchReport;
    directSourceResearch: DirectSourceResearchReport;
    directSourceSession: EvidenceIntakeSession | null;
    sourceRetrievalSession: EvidenceIntakeSession | null;
    leadTriage: ResearchLeadTriageReport | null;
    sourceRetrieval: ResearchSourceRetrievalReport | null;
  }>;
  /** Follow-up rounds: web research over explicitly scoped follow-up queries. */
  runWebResearch(input: { plannedQueries: DeepResearchPlannedQuery[] }): Promise<WebResearchReport>;
  buildLeadTriage?(): ResearchLeadTriageReport | null;
  retrieveSources?(): Promise<ResearchSourceRetrievalReport | null>;
  appendRetrievedSourceIntake?(report: ResearchSourceRetrievalReport): EvidenceIntakeSession | null;
  writeSweep(sweep: DeepResearchSweep): void;
}

export interface DeepResearchSweepResult {
  campaign: ResearchCampaign;
  webResearch: WebResearchReport;
  directSourceResearch: DirectSourceResearchReport;
  directSourceSession: EvidenceIntakeSession | null;
  sourceRetrievalSession: EvidenceIntakeSession | null;
  leadTriage: ResearchLeadTriageReport | null;
  sourceRetrieval: ResearchSourceRetrievalReport | null;
  sweep: DeepResearchSweep;
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Multi-round iterative deep research sweep.
 *
 * Round 0 runs the normal source-aware campaign at larger scale. Each
 * follow-up round derives new, scoped search angles from the previous round's
 * leads, searches them, re-triages and retrieves only the sources found in
 * that round, and extends the same governed intake session. Rounds stop as
 * soon as no new angle can be derived (or the bounded round budget is spent),
 * so the sweep can never spin unboundedly. Search output always stays
 * context-only research leads; nothing is imported into Evidence without the
 * intake/AI-shadow gate.
 */
export class RunDeepResearchSweepUseCase {
  constructor(private readonly deps: RunDeepResearchSweepUseCaseDeps) {}

  async execute(input: DeepResearchSweepInput = {}): Promise<DeepResearchSweepResult> {
    const generatedAt = this.deps.now();
    const maxRounds = clampInt(input.max_rounds, 20, 1, 20);
    const queriesPerRound = clampInt(input.queries_per_round, 50, 1, 50);
    const campaign = await this.deps.runCampaign({
      maxTasks: input.max_tasks ?? 120,
      maxQueries: input.max_queries ?? 24,
      maxDirectQueries: input.max_direct_queries ?? 30,
    });

    const round0Leads = campaign.webResearch.leads;
    const knownQueries = new Set<string>(campaign.webResearch.queries.map((q) => q.query.trim().toLowerCase()));
    const scopeNames = buildScopeNames(campaign.campaign.tasks);
    const rounds: DeepResearchSweepRound[] = [{
      round: 0,
      queries: campaign.webResearch.queries.length,
      leads: round0Leads.length,
      follow_up_queries: [],
    }];
    const totals = { rounds: 1, queries: campaign.webResearch.queries.length, leads: round0Leads.length };

    let previousLeads = round0Leads;
    let session = campaign.sourceRetrievalSession;
    let lastTriage = campaign.leadTriage;
    let lastRetrieval = campaign.sourceRetrieval;

    for (let round = 1; round <= maxRounds; round += 1) {
      const followUps = deriveFollowupQueries({ leads: previousLeads, scopeNames, knownQueries, budget: queriesPerRound });
      if (!followUps.length) break;
      for (const q of followUps) knownQueries.add(q.query.trim().toLowerCase());

      const report = await this.deps.runWebResearch({ plannedQueries: followUps });
      const leads = report.leads;

      // Each follow-up round re-enters the governed triage → retrieval →
      // intake-session path; appendRetrievedSourceIntake extends the latest
      // session so every round feeds the same boundary without re-importing.
      if (this.deps.buildLeadTriage && this.deps.retrieveSources && this.deps.appendRetrievedSourceIntake) {
        lastTriage = this.deps.buildLeadTriage();
        lastRetrieval = lastTriage ? await this.deps.retrieveSources() ?? null : null;
        if (lastRetrieval) session = this.deps.appendRetrievedSourceIntake(lastRetrieval) ?? session;
      }

      rounds.push({ round, queries: followUps.length, leads: leads.length, follow_up_queries: followUps.map((q) => q.query) });
      totals.rounds += 1;
      totals.queries += followUps.length;
      totals.leads += leads.length;
      previousLeads = leads;
    }

    const sweep: DeepResearchSweep = {
      artifact_type: 'deep_research_sweep',
      schema_version: '1.0.0',
      producer_version: this.deps.producerVersion(),
      sweep_id: `deep-sweep-${generatedAt}`,
      generated_at: generatedAt,
      campaign_task_count: campaign.campaign.tasks.length,
      rounds,
      totals,
      guardrail_check: {
        search_results_remain_context_only: true,
        bounded_rounds: true,
        bounded_queries: true,
        no_auto_import: true,
        no_trading_advice: true,
      },
    };
    this.deps.writeSweep(sweep);

    return { ...campaign, sourceRetrievalSession: session, leadTriage: lastTriage, sourceRetrieval: lastRetrieval, sweep };
  }
}
