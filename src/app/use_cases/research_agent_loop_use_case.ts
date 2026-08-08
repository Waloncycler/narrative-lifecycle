import type { IntakeAgentReviewBundle } from '@/features/intake/types/intake_agent';
import type { IntakeLearningCycle } from '@/features/intake/types/intake_learning_cycle';
import type { RunManifest } from '@/platform/types/run_context';
import type { WorldMonitorSyncResult } from '@/features/worldmonitor/types/worldmonitor_adapter';
import type { AutonomousResearchRun } from '@/features/research/types/autonomous_research';
import type { WebResearchReport } from '@/features/research/types/web_research';
import type { ResearchCampaign } from '@/features/research/types/research_coverage';
import type { DirectSourceResearchReport } from '@/features/research/types/direct_source_research';
import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { AgentPurgeDecision, ResearchAgentEvolutionLedger, ResearchAgentLoopKind, ResearchAgentRunManifest, ResearchAgentTrigger } from '@/features/research/types/research_agent';
import { purgeDecisions, agedQueueItems, staleCandidates, type AgedQueueItemInput, type StaleCandidateInput } from '@/features/research/domain/agent_purge_rules';
import { evolveLedger } from '@/features/research/domain/agent_evolution';

/**
 * Autonomous research agent loop.
 *
 * Orchestrates the daily "research analyst" cycle by reusing governed
 * capabilities:
 *
 *   research -> analyze -> produce -> iterate -> evolve/purge
 *
 * The loop syncs sources, drafts candidates, proposes Topic and Evidence-chain
 * updates, and applies versioned evidence-publication and graph-promotion
 * policies. Stage recomputation stays deterministic and Evidence-table-bound;
 * models never control Stage, Score, or rules.
 */

export interface ResearchAgentLoopDeps {
  producerVersion(): string;
  now(): string;
  runSourceSync(input: { mode: 'live'; maxOperations: number; maxCandidates: number; operationIds?: string[]; forceRefresh?: boolean }): Promise<WorldMonitorSyncResult>;
  runWebResearch?(input: { limit: number }): Promise<WebResearchReport>;
  runResearchCampaign?(input: { maxTasks: number; maxQueries: number; maxDirectQueries: number }): Promise<{ campaign: ResearchCampaign; webResearch: WebResearchReport; directSourceResearch: DirectSourceResearchReport; directSourceSession: EvidenceIntakeSession | null }>;
  runIntakeAgent(): Promise<IntakeAgentReviewBundle>;
  runAiShadow(): Promise<{ report: import('@/features/intake/types/intake').AiShadowValidationReport | null }>;
  runLearningCycle(): IntakeLearningCycle;
  runValidateTopics(): unknown;
  runAutonomousResearch(bundle: IntakeAgentReviewBundle | null, publish?: boolean): AutonomousResearchRun;
  runReview(): unknown;
  readStaleCandidates(): StaleCandidateInput[];
  readQueueItems(): AgedQueueItemInput[];
  discardPurged(decisions: AgentPurgeDecision[]): void;
  readEvolutionLedger(): ResearchAgentEvolutionLedger | null;
  writeEvolutionLedger(ledger: ResearchAgentEvolutionLedger): void;
  readLearningMetrics(): { acceptance_rate: number | null; shadow_agreement_rate: number | null; golden_gate_pass_rate: number | null };
  writeRunManifest(manifest: ResearchAgentRunManifest): void;
}

export interface ResearchAgentLoopInput {
  loop_kind?: ResearchAgentLoopKind;
  triggered_by?: ResearchAgentTrigger;
  /** Explicit source targeting is for operator verification; the scheduler
   * normally relies on the bounded, priority-ordered default selection. */
  operation_ids?: string[];
  /** Reprocess the selected source payloads once, while keeping all normal
   * change detection and publication guards in force. */
  force_refresh?: boolean;
  purge?: {
    stale_candidate_max_age_days: number;
    queue_high_priority_max_age_days: number;
    queue_medium_priority_max_age_days: number;
    queue_low_priority_max_age_days: number;
    evolution_history_max_entries: number;
  };
}

export class ResearchAgentLoopUseCase {
  constructor(private readonly deps: ResearchAgentLoopDeps) {}

  async execute(input: ResearchAgentLoopInput = {}): Promise<ResearchAgentRunManifest> {
    const loopKind = input.loop_kind ?? 'manual';
    const triggeredBy = input.triggered_by ?? 'manual';
    const startedAt = this.deps.now();
    const runId = `agent_run_${startedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`;
    const phases: ResearchAgentRunManifest['phases'] = [];
    const metrics: ResearchAgentRunManifest['metrics'] = {
      sources_requested: 0,
      sources_completed: 0,
      sources_failed: 0,
      web_research_queries: 0,
      web_research_leads: 0,
      direct_source_queries: 0,
      direct_source_leads: 0,
      research_campaign_tasks: 0,
      research_campaign_source_targets: 0,
      research_campaign_seed_topics: 0,
      candidate_count: 0,
      imported_evidence_count: 0,
      provisional_topics_activated: 0,
      watch_branches_activated: 0,
      graph_nodes_held: 0,
      weekly_run_id: null,
      learning_cycle_id: null,
      purged_stale_candidates: 0,
      purged_aged_queue_items: 0,
      evolution_proposals: 0,
      drift_detected: false,
    };
    let status: ResearchAgentRunManifest['status'] = 'completed';

    const run = async <T>(
      phase: ResearchAgentRunManifest['phases'][number]['phase'],
      detail: string,
      fn: () => Promise<T> | T,
      skippable?: (error: unknown) => boolean,
    ): Promise<T | undefined> => {
      const started = this.deps.now();
      try {
        const result = await fn();
        phases.push({ phase, status: 'ok', detail, started_at: started, completed_at: this.deps.now(), artifact_paths: [] });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (skippable?.(error)) {
          const waitingForReview = phase === 'iterate'
            && /session mismatch|no reviewed decisions|not enough history|insufficient_history|no evaluation/i.test(message);
          phases.push({
            phase,
            status: 'skipped',
            detail: waitingForReview
              ? 'waiting for human review feedback from the current intake session; prior-session feedback is not reused for learning calibration'
              : `skipped: ${detail} (${message})`,
            started_at: started,
            completed_at: this.deps.now(),
            artifact_paths: [],
          });
          return undefined;
        }
        status = 'partial';
        phases.push({
          phase,
          status: 'failed',
          detail: `${detail}: ${message}`,
          started_at: started,
          completed_at: this.deps.now(),
          artifact_paths: [],
        });
        metrics.drift_detected = true;
        return undefined;
      }
    };

    const stage = (phase: ResearchAgentRunManifest['phases'][number]['phase'], detail: string): void => {
      const started = this.deps.now();
      phases.push({ phase, status: 'skipped', detail, started_at: started, completed_at: started, artifact_paths: [] });
    };

    // Phase 1: search is discovery-only. Its snippets cannot become Evidence,
    // but they make coverage gaps visible before governed source sync starts.
    let campaignResult: { campaign: ResearchCampaign; webResearch: WebResearchReport; directSourceResearch: DirectSourceResearchReport; directSourceSession: EvidenceIntakeSession | null } | undefined;
    if (this.deps.runResearchCampaign) {
      campaignResult = await run('research', 'source-aware topic and branch coverage campaign; results remain context-only research leads', () =>
        this.deps.runResearchCampaign!({
          maxTasks: loopKind === 'quick' ? 24 : 60,
          maxQueries: loopKind === 'quick' ? 2 : 12,
          maxDirectQueries: loopKind === 'quick' ? 6 : 18,
        }),
      ) as { campaign: ResearchCampaign; webResearch: WebResearchReport; directSourceResearch: DirectSourceResearchReport; directSourceSession: EvidenceIntakeSession | null } | undefined;
      metrics.web_research_queries = campaignResult?.webResearch.queries.length ?? 0;
      metrics.web_research_leads = campaignResult?.webResearch.lead_count ?? 0;
      metrics.direct_source_queries = campaignResult?.directSourceResearch.queries.filter((query) => query.status !== 'skipped').length ?? 0;
      metrics.direct_source_leads = campaignResult?.directSourceResearch.lead_count ?? 0;
      metrics.research_campaign_tasks = campaignResult?.campaign.summary.task_count ?? 0;
      metrics.research_campaign_source_targets = campaignResult?.campaign.summary.source_target_count ?? 0;
      metrics.research_campaign_seed_topics = campaignResult?.campaign.summary.universe_seed_count ?? 0;
    } else if (this.deps.runWebResearch) {
      const webResearch = await run('research', 'public-web discovery; results remain context-only research leads', () =>
        this.deps.runWebResearch!({ limit: loopKind === 'quick' ? 2 : 6 }),
      ) as WebResearchReport | undefined;
      metrics.web_research_queries = webResearch?.queries.length ?? 0;
      metrics.web_research_leads = webResearch?.lead_count ?? 0;
    }

    const campaignOperationIds = campaignResult?.campaign.tasks?.flatMap((task) => task.direct_operation_ids ?? []) ?? [];
    const requestedOperationIds = [...new Set([...(input.operation_ids ?? []), ...campaignOperationIds])];

    // Phase 1: research - execute only queryable direct operations already
    // associated with the coverage plan, plus explicit operator verification.
    // Never fall back to unrelated generic feeds during a campaign.
    const syncResult = requestedOperationIds.length || !campaignResult
      ? (await run('research', 'live source sync across source-aware direct and world-monitor operations', async () =>
        this.deps.runSourceSync({
          mode: 'live',
          maxOperations: loopKind === 'quick' ? 12 : 40,
          maxCandidates: 40,
          operationIds: requestedOperationIds.length ? requestedOperationIds : undefined,
          forceRefresh: input.force_refresh,
        }),
      )) as WorldMonitorSyncResult | undefined
      : undefined;
    if (!requestedOperationIds.length && campaignResult) {
      stage('research', 'no task-bound WorldMonitor sync operation is configured; generic polling skipped after the campaign already ran its bounded authoritative API queries');
    }
    if (syncResult) {
      metrics.sources_requested = syncResult.report.requested_operation_count;
      metrics.sources_completed = syncResult.report.completed_operation_count;
      metrics.sources_failed = syncResult.report.failed_operation_count ?? 0;
    }

    // Phase 2: analyze - draft candidates with the intake agent, then shadow-validate
    const intakeSession = syncResult?.session ?? campaignResult?.directSourceSession ?? null;
    const agentBundle = intakeSession
      ? (await run('analyze', 'intake agent drafting + AI shadow validation for source-backed candidates', async () => {
        const bundle = await this.deps.runIntakeAgent();
        await this.deps.runAiShadow();
        return bundle;
      })) as IntakeAgentReviewBundle | undefined
      : undefined;
    if (!intakeSession) stage('analyze', 'no new source facts or direct-source records; previous candidate session was not reused');
    metrics.candidate_count = agentBundle?.candidates.length ?? 0;

    // Phase 3: publication boundary - deterministic policy decides which
    // model-validated, provenance-backed candidates may enter live evidence.
    const autonomousRun = await run('import', agentBundle
      ? 'apply autonomous Evidence publication policy and rebuild live Topic state'
      : 'record a no-change operational state without reusing prior candidates', () => {
      this.deps.runValidateTopics();
      return this.deps.runAutonomousResearch(agentBundle ?? null, Boolean(agentBundle));
    }) as AutonomousResearchRun | undefined;
    metrics.imported_evidence_count = autonomousRun?.report.published_count ?? 0;
    metrics.provisional_topics_activated = autonomousRun?.graph_promotion.summary.provisional_topics_activated ?? 0;
    metrics.watch_branches_activated = autonomousRun?.graph_promotion.summary.watch_branches_activated ?? 0;
    metrics.graph_nodes_held = autonomousRun?.graph_promotion.summary.held_count ?? 0;

    // Phase 4: produce - the autonomous use case writes the canonical
    // operator Weekly/Diff artifacts. Review reads the same operator-run
    // history instead of falling back to golden-case fixtures.
    if (autonomousRun) {
      const manifest = await run('produce', 'publish operational weekly artifacts and refresh operator review', () => {
        this.deps.runReview();
        return autonomousRun.manifest;
      });
      metrics.weekly_run_id = manifest?.run_id ?? null;
    } else stage('produce', 'no operational state was available to publish');

    // Phase 5: iterate - refresh the learning profile, queue, and proposals
    const cycle = (await run(
      'iterate',
      'rebuild learning profile and active learning cycle',
      () => this.deps.runLearningCycle(),
      (error) => /session mismatch|no reviewed decisions|not enough history|insufficient_history|no evaluation/i.test(error instanceof Error ? error.message : String(error)),
    )) as IntakeLearningCycle | undefined;
    metrics.learning_cycle_id = cycle?.cycle_id ?? null;

    // Phase 6: evolve & purge - discard the agent's own unreviewed artifacts and update the evolution ledger
    const purge = input.purge ?? {
      stale_candidate_max_age_days: 30,
      queue_high_priority_max_age_days: 14,
      queue_medium_priority_max_age_days: 21,
      queue_low_priority_max_age_days: 30,
      evolution_history_max_entries: 30,
    };
    const stale = staleCandidates(this.deps.readStaleCandidates(), startedAt, purge.stale_candidate_max_age_days);
    const aged = agedQueueItems(this.deps.readQueueItems(), startedAt, purge);
    const purgeToApply = purgeDecisions([...stale, ...aged]);
    const evolution = (await run('evolve', 'purge unreviewed artifacts and update evolution ledger', () => {
      if (purgeToApply.length > 0) this.deps.discardPurged(purgeToApply);
      const previous = this.deps.readEvolutionLedger();
      const learningMetrics = this.deps.readLearningMetrics();
      const ledger = evolveLedger(
        previous,
        {
          run_id: runId,
          recorded_at: startedAt,
          acceptance_rate: learningMetrics.acceptance_rate,
          shadow_agreement_rate: learningMetrics.shadow_agreement_rate,
          golden_gate_pass_rate: learningMetrics.golden_gate_pass_rate,
          candidate_count: metrics.candidate_count,
        },
        this.deps.producerVersion(),
        undefined,
        purge.evolution_history_max_entries,
      );
      this.deps.writeEvolutionLedger(ledger);
      return ledger;
    })) as ResearchAgentEvolutionLedger | undefined;
    metrics.purged_stale_candidates = purgeToApply.filter((decision) => decision.category === 'stale_candidate').length;
    metrics.purged_aged_queue_items = purgeToApply.filter((decision) => decision.category === 'aged_queue_item').length;
    metrics.evolution_proposals = evolution?.proposals.filter((proposal) => proposal.created_at >= startedAt || proposal.status === 'proposed').length ?? 0;
    metrics.drift_detected = evolution?.drift_flags.some((flag) => flag.detected) ?? false;

    const completedAt = this.deps.now();
    const manifest: ResearchAgentRunManifest = {
      artifact_type: 'research_agent_run_manifest',
      schema_version: '1.0.0',
      producer_version: this.deps.producerVersion(),
      run_id: runId,
      triggered_by: triggeredBy,
      loop_kind: loopKind,
      started_at: startedAt,
      completed_at: completedAt,
      status,
      phases,
      metrics,
      guardrail_check: {
        no_auto_import: metrics.imported_evidence_count === 0,
        no_auto_stage_change: false,
        no_auto_topic_activation: metrics.provisional_topics_activated + metrics.watch_branches_activated === 0,
        no_auto_rule_mutation: true,
        human_review_required: metrics.graph_nodes_held > 0,
        no_trading_advice: true,
      },
    };
    this.deps.writeRunManifest(manifest);
    return manifest;
  }
}
