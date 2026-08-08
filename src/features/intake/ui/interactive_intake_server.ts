import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { stringify } from 'yaml';
import type { EvidenceIntakeApplyResult, EvidenceIntakeSession, ReviewDecision } from '@/features/intake/types/intake';
import type { EvidenceImportDraft } from '@/features/evidence/types/evidence_import';
import type { StageDiff, StageSnapshotHistory } from '@/features/stages/types/diff';
import type { OperatorReview } from '@/features/reporting/types/operator_review';
import type { WeeklyBrief } from '@/features/reporting/types/report';
import type { RunManifest } from '@/platform/types/run_context';
import type { IntakeAgentAudit, IntakeAgentVerificationReport } from '@/features/intake/types/intake_agent';
import type { TopicResolutionAudit } from '@/features/narrative/types/topic_resolution';
import type { WorldMonitorSourceInventory, WorldMonitorSyncReport } from '@/features/worldmonitor/types/worldmonitor_adapter';
import type { ResearchCampaign } from '@/features/research/types/research_coverage';
import type { DirectSourceResearchReport } from '@/features/research/types/direct_source_research';
import type { ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';
import type { ResearchBaselineCompletionReport } from '@/features/research/types/research_baseline_completion';
import { DEFAULT_SCHEDULER_CONFIG } from '@/features/research/types/research_agent';
import { createProductCoreUseCases } from '@/platform/io/file_system_adapters';
import { intakeAgentConfigFromEnv } from '@/features/intake/io/intake_agent_provider';
import { buildNarrativeMonitor } from '@/features/narrative/domain/narrative_monitor';
import {
  renderAgentDashboard,
  renderAgentRuns,
  renderChanges,
  renderEvidenceInbox,
  renderGovernance,
  renderMethodology,
  renderNarrativeMonitor,
  renderQueue,
  renderSources,
  renderSystemOverview,
  renderTopicDetail,
  renderTopics,
} from '@/features/narrative/ui/narrative_monitor_renderer';

const interactiveDecisionPath = 'outputs/intake/interactive_review_decisions.yaml';
type ProductCoreUseCases = ReturnType<typeof createProductCoreUseCases>;

export function createInteractiveIntakeServer(repoRoot: string, useCases: ProductCoreUseCases = createProductCoreUseCases(repoRoot)): Server {
  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (request.method === 'GET' && pathname === '/favicon.ico') {
        response.writeHead(204);
        return response.end();
      }
      if (request.method === 'GET' && pathname === '/') return html(response, renderNarrativeMonitor(readMonitor(repoRoot, useCases)));
      if (request.method === 'GET' && pathname === '/intake') return html(response, renderInteractiveWorkbench());
      if (request.method === 'GET' && pathname === '/changes') return html(response, renderChanges(readMonitor(repoRoot, useCases)));
      if (request.method === 'GET' && pathname === '/topics') return html(response, renderTopics(readMonitor(repoRoot, useCases)));
      if (request.method === 'GET' && pathname === '/inbox') return html(response, renderEvidenceInbox(readMonitor(repoRoot, useCases)));
      if (request.method === 'GET' && pathname === '/queue') return html(response, renderQueue(readMonitor(repoRoot, useCases)));
      if (request.method === 'GET' && pathname === '/agent') return html(response, renderAgentDashboard(readMonitor(repoRoot, useCases)));
      if (request.method === 'GET' && pathname === '/runs') return html(response, renderAgentRuns(readMonitor(repoRoot, useCases)));
      if (request.method === 'GET' && pathname === '/system') return html(response, renderSystemOverview(readMonitor(repoRoot, useCases)));
      if (request.method === 'GET' && pathname === '/sources') return html(response, renderSources(readMonitor(repoRoot, useCases)));
      if (request.method === 'GET' && pathname === '/methodology') return html(response, renderMethodology());
      if (request.method === 'GET' && pathname === '/governance') return html(response, renderGovernance(readMonitor(repoRoot, useCases)));
      if (request.method === 'GET' && pathname.startsWith('/topics/')) return html(response, renderTopicDetail(readMonitor(repoRoot, useCases), decodeURIComponent(pathname.slice('/topics/'.length))));
      if (request.method === 'GET' && pathname === '/api/state') return json(response, readState(repoRoot));
      if (request.method === 'GET' && pathname === '/api/evolution-timeline') {
        try {
          const content = readFileSync(resolve(repoRoot, 'outputs/evolution_timelines/all_topics_evolution.json'), 'utf8');
          return json(response, JSON.parse(content));
        } catch (e) {
          return json(response, []);
        }
      }
      if (request.method === 'GET' && pathname === '/api/monitor') return json(response, readMonitor(repoRoot, useCases));
      if (request.method === 'GET' && pathname === '/api/agent/state') return json(response, readAgentState(repoRoot, useCases));
      if (request.method === 'POST' && pathname === '/api/intelligence-review') {
        const body = await readJson<{ proposal_id?: string; chain_entry_id?: string; decision: 'accepted' | 'rejected' | 'deferred'; reviewer: string; note?: string }>(request);
        const result = useCases.reviewIntelligenceProposalUseCase.execute({
          proposalId: body.proposal_id,
          chainEntryId: body.chain_entry_id,
          decision: body.decision,
          reviewer: body.reviewer,
          note: body.note,
        });
        return json(response, { result, state: readState(repoRoot), monitor: readMonitor(repoRoot, useCases) });
      }
      if (request.method === 'GET' && pathname === '/api/agent/scheduler-config') return json(response, { config: useCases.researchAgentRepository.readSchedulerConfig() });
      if (request.method === 'PUT' && pathname === '/api/agent/scheduler-config') {
        const body = await readJson<import('@/features/research/types/research_agent').ResearchAgentSchedulerConfig>(request);
        useCases.researchAgentRepository.writeSchedulerConfig(sanitizeSchedulerConfig(body));
        return json(response, { config: useCases.researchAgentRepository.readSchedulerConfig() });
      }
      if (request.method === 'POST' && pathname === '/api/agent/run') {
        const body = await readJson<{ loop_kind?: 'daily' | 'quick' | 'manual' }>(request);
        // 完整 research loop（源同步 + 候选草拟 + 影子校验 + 报告）可能耗时数分钟，
        // 同步等待会导致浏览器请求被中止（ERR_ABORTED）。改为后台执行，立即返回，
        // 前端通过 /api/agent/state 轮询 loop_running 与 last_run。
        if (useCases.researchAgentScheduler.running) {
          return json(response, { status: 'already_running' });
        }
        void useCases.researchAgentScheduler
          .runNow(body.loop_kind ?? 'manual')
          .catch((error) => console.error('research agent loop failed:', error instanceof Error ? error.message : error));
        return json(response, { status: 'started' });
      }
      if (request.method === 'POST' && pathname === '/api/research/search') {
        const body = await readJson<{ topic_ids?: string[]; queries?: string[]; limit?: number }>(request);
        const report = await useCases.runWebResearchUseCase.execute({
          topicIds: body.topic_ids,
          queries: body.queries,
          limit: typeof body.limit === 'number' ? body.limit : undefined,
        });
        return json(response, { report, state: readState(repoRoot), monitor: readMonitor(repoRoot, useCases) });
      }
      if (request.method === 'POST' && pathname === '/api/research/campaign') {
        const body = await readJson<{ max_tasks?: number; max_queries?: number }>(request);
        const result = await useCases.runResearchCampaignUseCase.execute({
          maxTasks: typeof body.max_tasks === 'number' ? body.max_tasks : undefined,
          maxQueries: typeof body.max_queries === 'number' ? body.max_queries : undefined,
        });
        return json(response, { result, state: readState(repoRoot), monitor: readMonitor(repoRoot, useCases) });
      }
      if (request.method === 'POST' && pathname === '/api/sources/inventory') {
        const inventory = useCases.syncWorldMonitorSourcesUseCase.inventory();
        return json(response, { inventory, monitor: readMonitor(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/sources/sync') {
        const body = await readJson<{
          mode?: 'sandbox' | 'live';
          operation_ids?: string[];
          include_context?: boolean;
          max_operations?: number;
          max_candidates?: number;
        }>(request);
        const result = await useCases.syncWorldMonitorSourcesUseCase.execute({
          mode: body.mode === 'live' ? 'live' : 'sandbox',
          operationIds: body.operation_ids,
          includeContext: body.include_context,
          maxOperations: body.max_operations ?? 20,
          maxCandidates: body.max_candidates ?? 30,
        });
        let autonomy = null;
        if (result.session) {
          const bundle = await useCases.runIntakeAgentUseCase.executeLatest();
          useCases.validateTopicsUseCase.execute();
          autonomy = useCases.runAutonomousResearchUseCase.execute({ bundle });
        }
        return json(response, { result, autonomy, state: readState(repoRoot), monitor: readMonitor(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/prepare-text') {
        const body = await readJson<{ text: string }>(request);
        const session = useCases.prepareEvidenceIntakeUseCase.execute({ text: body.text });
        const bundle = await useCases.runIntakeAgentUseCase.executeLatest();
        await useCases.runAiShadowValidationUseCase.execute();
        const audit = useCases.validateTopicsUseCase.execute();
        const autonomy = useCases.runAutonomousResearchUseCase.execute({ bundle });
        return json(response, { session, audit, autonomy, automation: completedAutomation(), state: readState(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/upload') {
        const upload = await readMultipartFile(request);
        const relativePath = writeUpload(repoRoot, upload.fileName, upload.body);
        const session = useCases.prepareEvidenceIntakeUseCase.execute({ file: relativePath });
        const bundle = await useCases.runIntakeAgentUseCase.executeLatest();
        await useCases.runAiShadowValidationUseCase.execute();
        const audit = useCases.validateTopicsUseCase.execute();
        const autonomy = useCases.runAutonomousResearchUseCase.execute({ bundle });
        return json(response, { session, audit, autonomy, automation: completedAutomation(), state: readState(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/ai-shadow') {
        const result = await useCases.runAiShadowValidationUseCase.execute();
        return json(response, { audit: result.audit, report: result.report, state: readState(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/intake-agent') {
        const bundle = await useCases.runIntakeAgentUseCase.executeLatest();
        const autonomy = useCases.runAutonomousResearchUseCase.execute({ bundle });
        return json(response, { bundle, autonomy, state: readState(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/autonomy/run') {
        const autonomy = useCases.runAutonomousResearchUseCase.execute();
        return json(response, { autonomy, state: readState(repoRoot), monitor: readMonitor(repoRoot, useCases) });
      }
      if (request.method === 'POST' && pathname === '/api/topic-validate') {
        const audit = useCases.validateTopicsUseCase.execute();
        return json(response, { audit, state: readState(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/apply') {
        const body = await readJson<{ session_id?: string; decisions: InteractiveReviewDecision[] }>(request);
        const currentSession = readJsonFile<EvidenceIntakeSession>(repoRoot, 'outputs/intake/latest_session.json');
        if (!body.session_id || body.session_id !== currentSession?.session_id) {
          throw new Error('stale review submission: session_id does not match the current Intake session');
        }
        const decisions = sanitizeInteractiveDecisions(body.decisions);
        writeDecisions(repoRoot, decisions);
        const apply = useCases.applyEvidenceIntakeReviewUseCase.execute({ decisionsFile: interactiveDecisionPath });
        const audit = useCases.validateTopicsUseCase.execute();
        const evaluation = useCases.evaluateIntakeUseCase.execute({ decisionsFile: interactiveDecisionPath });
        const profile = useCases.buildIntakeLearningProfileUseCase.execute({ decisionsFile: interactiveDecisionPath });
        const learningCycle = useCases.buildIntakeLearningCycleUseCase.execute();
        return json(response, { apply, audit, evaluation, profile, learning_cycle: learningCycle, state: readState(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/retry-weekly') {
        const body = await readJson<{ session_id?: string }>(request);
        if (!body.session_id) throw new Error('pipeline retry requires session_id');
        const apply = useCases.retryEvidenceIntakePipelineUseCase.execute({ sessionId: body.session_id });
        return json(response, { apply, state: readState(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/evaluate') {
        const evaluation = useCases.evaluateIntakeUseCase.execute({ decisionsFile: interactiveDecisionPath });
        return json(response, { evaluation, state: readState(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/learn') {
        const profile = useCases.buildIntakeLearningProfileUseCase.execute({ decisionsFile: interactiveDecisionPath });
        const learningCycle = useCases.buildIntakeLearningCycleUseCase.execute();
        return json(response, { profile, learning_cycle: learningCycle, state: readState(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/learning-cycle') {
        const learningCycle = useCases.buildIntakeLearningCycleUseCase.execute();
        return json(response, { learning_cycle: learningCycle, state: readState(repoRoot) });
      }
      if (request.method === 'POST' && pathname === '/api/agent/confirm-all-chain-entries') {
        const chainPath = resolve(repoRoot, 'outputs/intake/latest_evidence_chain.json');
        if (existsSync(chainPath)) {
          const entries = JSON.parse(readFileSync(chainPath, 'utf8')) as import('@/features/evidence/types/evidence_chain').EvidenceChainEntry[];
          const updated = entries.map((entry) => ({
            ...entry,
            status: 'confirmed' as const,
            operator_decision: { reviewer: 'autonomous_agent', decided_at: new Date().toISOString(), note: 'Auto-confirmed by autonomous agent' },
          }));
          writeFileSync(chainPath, JSON.stringify(updated, null, 2));
        }
        const proposalPath = resolve(repoRoot, 'outputs/intake/latest_topic_discovery_proposals.json');
        if (existsSync(proposalPath)) {
          const proposals = JSON.parse(readFileSync(proposalPath, 'utf8')) as import('@/features/narrative/types/topic_discovery').TopicDiscoveryProposal[];
          const updatedProposals = proposals.map((p) => ({ ...p, status: 'accepted' as const }));
          writeFileSync(proposalPath, JSON.stringify(updatedProposals, null, 2));
        }
        return json(response, { status: 'ok', state: readState(repoRoot) });
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not_found' }));
    } catch (error) {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
}

function completedAutomation(): { status: 'completed'; steps: string[] } {
  return {
    status: 'completed',
    steps: ['文档解析', '规则候选', 'AI Shadow 对照', 'Topic/Branch 检查', '引用与安全校验'],
  };
}

interface InteractiveReviewDecision extends ReviewDecision {
  topic_resolution_status?: string;
}

function sanitizeInteractiveDecisions(decisions: InteractiveReviewDecision[]): ReviewDecision[] {
  return decisions.map((decision) => {
    return decision;
  });
}

function writeDecisions(repoRoot: string, decisions: ReviewDecision[]): void {
  const path = resolve(repoRoot, interactiveDecisionPath);
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, stringify(decisions));
}

function readState(repoRoot: string): Record<string, unknown> {
  const session = readJsonFile<EvidenceIntakeSession>(repoRoot, 'outputs/intake/latest_session.json');
  const latestApply = readJsonFile<EvidenceIntakeApplyResult>(repoRoot, 'outputs/intake/latest_apply_result.json');
  const apply = latestApply?.session_id === session?.session_id ? latestApply : null;
  const latestWeekly = readJsonFile<WeeklyBrief>(repoRoot, 'outputs/operator_runs/latest_weekly_brief.json')
    ?? readJsonFile<WeeklyBrief>(repoRoot, 'outputs/reports/weekly_brief.json');
  // Intake is session-scoped: a newly pasted, unreviewed document must never
  // appear to have caused the most recent operational report. The monitor
  // routes expose the canonical live state separately.
  const weekly = apply?.weekly_run_id && latestWeekly?.run_id === apply.weekly_run_id ? latestWeekly : null;
  const latestDiff = readJsonFile<StageDiff>(repoRoot, 'outputs/operator_runs/latest_stage_diff.json')
    ?? readJsonFile<StageDiff>(repoRoot, 'outputs/diffs/latest_stage_diff.json');
  const stageDiff = apply?.weekly_run_id && latestDiff?.run_id === apply.weekly_run_id ? latestDiff : null;
  const latestTopicAudit = readJsonFile<TopicResolutionAudit>(repoRoot, 'outputs/intake/latest_topic_resolution_audit.json');
  const topicAudit = latestTopicAudit?.session_id === session?.session_id ? latestTopicAudit : null;
  const latestEvaluation = readJsonFile<{ session_id?: string }>(repoRoot, 'outputs/intake/latest_evaluation.json');
  const evaluation = latestEvaluation?.session_id === session?.session_id ? latestEvaluation : null;
  return {
    session,
    topic_audit: topicAudit,
    apply_result: apply,
    evaluation,
    weekly_brief: weekly,
    stage_diff: stageDiff,
    ai_shadow_audit: readJsonFile(repoRoot, 'outputs/intake/latest_ai_shadow_audit.json'),
    ai_shadow_validation_report: readJsonFile(repoRoot, 'outputs/intake/latest_ai_shadow_validation_report.json'),
    agent_candidates: readJsonFile(repoRoot, 'outputs/intake/latest_agent_candidates.json'),
    agent_verification: readJsonFile(repoRoot, 'outputs/intake/latest_agent_verification.json'),
    agent_audit: readJsonFile(repoRoot, 'outputs/intake/latest_agent_audit.json'),
    learning_profile: readJsonFile(repoRoot, 'outputs/intake/latest_learning_profile.json'),
    learning_cycle: readJsonFile(repoRoot, 'outputs/intake/latest_learning_cycle.json'),
    topic_discovery_proposals: readJsonFile(repoRoot, 'outputs/intake/latest_topic_discovery_proposals.json') ?? [],
    evidence_chain: readJsonFile(repoRoot, 'outputs/intake/latest_evidence_chain.json') ?? [],
    autonomous_promotion: readJsonFile(repoRoot, 'outputs/autonomy/latest_promotion_report.json'),
    narrative_graph_promotion: readJsonFile(repoRoot, 'outputs/autonomy/latest_narrative_graph_promotion.json'),
    autonomous_state: readJsonFile(repoRoot, 'outputs/autonomy/latest_run.json'),
    web_research: readJsonFile(repoRoot, 'outputs/research/latest_web_research.json'),
    research_campaign: readJsonFile<ResearchCampaign>(repoRoot, 'outputs/research/latest_campaign.json'),
    direct_source_research: readJsonFile<DirectSourceResearchReport>(repoRoot, 'outputs/research/latest_direct_source_research.json'),
    research_lead_triage: readJsonFile<ResearchLeadTriageReport>(repoRoot, 'outputs/research/latest_lead_triage.json'),
    research_source_retrieval: readJsonFile<ResearchSourceRetrievalReport>(repoRoot, 'outputs/research/latest_source_retrieval.json'),
    research_baseline_completion: readJsonFile<ResearchBaselineCompletionReport>(repoRoot, 'outputs/research/latest_baseline_completion.json'),
  };
}

function readAgentState(repoRoot: string, useCases: ProductCoreUseCases) {
  return {
    research_agent: {
      enabled: useCases.researchAgentRepository.readSchedulerConfig().enabled,
      loop_running: useCases.researchAgentScheduler.running,
      next_daily_run: useCases.researchAgentScheduler.nextDailyRun(),
      last_run: readJsonFile(repoRoot, 'outputs/research_agent/latest_run.json'),
      run_history: useCases.researchAgentRepository.listRunManifests(),
      evolution: useCases.researchAgentRepository.readEvolutionLedger(),
      scheduler: useCases.researchAgentRepository.readSchedulerConfig(),
      web_research: readJsonFile(repoRoot, 'outputs/research/latest_web_research.json'),
      research_campaign: readJsonFile<ResearchCampaign>(repoRoot, 'outputs/research/latest_campaign.json'),
      direct_source_research: readJsonFile<DirectSourceResearchReport>(repoRoot, 'outputs/research/latest_direct_source_research.json'),
      research_lead_triage: readJsonFile<ResearchLeadTriageReport>(repoRoot, 'outputs/research/latest_lead_triage.json'),
      research_source_retrieval: readJsonFile<ResearchSourceRetrievalReport>(repoRoot, 'outputs/research/latest_source_retrieval.json'),
      research_baseline_completion: readJsonFile<ResearchBaselineCompletionReport>(repoRoot, 'outputs/research/latest_baseline_completion.json'),
    },
    state: readState(repoRoot),
  };
}

function sanitizeSchedulerConfig(body: import('@/features/research/types/research_agent').ResearchAgentSchedulerConfig): import('@/features/research/types/research_agent').ResearchAgentSchedulerConfig {
  const defaults = DEFAULT_SCHEDULER_CONFIG;
  return {
    ...defaults,
    ...body,
    enabled: Boolean(body.enabled ?? defaults.enabled),
    timezone: typeof body.timezone === 'string' && body.timezone ? body.timezone : defaults.timezone,
    daily_cron: typeof body.daily_cron === 'string' && body.daily_cron.trim() ? body.daily_cron.trim() : defaults.daily_cron,
    daily_max_operations: clampInt(body.daily_max_operations, defaults.daily_max_operations, 1, 200),
    quick_interval_hours: clampInt(body.quick_interval_hours, defaults.quick_interval_hours, 1, 72),
    quick_max_operations: clampInt(body.quick_max_operations, defaults.quick_max_operations, 1, 200),
    quick_enabled: Boolean(body.quick_enabled ?? defaults.quick_enabled),
    purge: {
      ...defaults.purge,
      ...(body.purge ?? {}),
      stale_candidate_max_age_days: clampInt(body.purge?.stale_candidate_max_age_days, defaults.purge.stale_candidate_max_age_days, 1, 365),
      queue_high_priority_max_age_days: clampInt(body.purge?.queue_high_priority_max_age_days, defaults.purge.queue_high_priority_max_age_days, 1, 365),
      queue_medium_priority_max_age_days: clampInt(body.purge?.queue_medium_priority_max_age_days, defaults.purge.queue_medium_priority_max_age_days, 1, 365),
      queue_low_priority_max_age_days: clampInt(body.purge?.queue_low_priority_max_age_days, defaults.purge.queue_low_priority_max_age_days, 1, 365),
      evolution_history_max_entries: clampInt(body.purge?.evolution_history_max_entries, defaults.purge.evolution_history_max_entries, 3, 100),
    },
    guardrail_check: defaults.guardrail_check,
  };
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function readMonitor(repoRoot: string, useCases?: ProductCoreUseCases) {
  const snapshot = readCurrentSnapshot(repoRoot);
  const weekly = readJsonFile<WeeklyBrief>(repoRoot, 'outputs/operator_runs/latest_weekly_brief.json')
    ?? readJsonFile<WeeklyBrief>(repoRoot, 'outputs/reports/weekly_brief.json');
  const diff = readJsonFile<StageDiff>(repoRoot, 'outputs/autonomy/latest_stage_diff.json')
    ?? readJsonFile<StageDiff>(repoRoot, 'outputs/diffs/latest_stage_diff.json');
  const review = readJsonFile<OperatorReview>(repoRoot, 'outputs/reviews/latest_operator_review.json');
  const topicAudit = readJsonFile<TopicResolutionAudit>(repoRoot, 'outputs/intake/latest_topic_resolution_audit.json');
  const learning = readJsonFile<{ profile_version?: string }>(repoRoot, 'outputs/intake/latest_learning_profile.json');
  const learningCycle = readJsonFile<import('@/features/intake/types/intake_learning_cycle').IntakeLearningCycle>(repoRoot, 'outputs/intake/latest_learning_cycle.json');
  const latestRun = readJsonFile<RunManifest>(repoRoot, 'outputs/operator_runs/latest_run.json')
    ?? readJsonFile<RunManifest>(repoRoot, 'outputs/runs/latest_run.json');
  const intakeSession = readJsonFile<EvidenceIntakeSession>(repoRoot, 'outputs/intake/latest_session.json');
  const applyResult = readJsonFile<EvidenceIntakeApplyResult>(repoRoot, 'outputs/intake/latest_apply_result.json');
  const agentAudit = readJsonFile<IntakeAgentAudit>(repoRoot, 'outputs/intake/latest_agent_audit.json');
  const agentVerification = readJsonFile<IntakeAgentVerificationReport>(repoRoot, 'outputs/intake/latest_agent_verification.json');
  const sourceInventory = readJsonFile<WorldMonitorSourceInventory>(repoRoot, 'outputs/sources/latest_source_inventory.json');
  const sourceSync = readJsonFile<WorldMonitorSyncReport>(repoRoot, 'outputs/sources/latest_sync_report.json');
  const graphPromotion = readJsonFile<import('@/features/narrative/types/narrative_graph_promotion').NarrativeGraphPromotionReport>(repoRoot, 'outputs/autonomy/latest_narrative_graph_promotion.json');
  const webResearch = readJsonFile<import('@/features/research/types/web_research').WebResearchReport>(repoRoot, 'outputs/research/latest_web_research.json');
  const researchCampaign = readJsonFile<ResearchCampaign>(repoRoot, 'outputs/research/latest_campaign.json');
  const directSourceResearch = readJsonFile<DirectSourceResearchReport>(repoRoot, 'outputs/research/latest_direct_source_research.json');
  const researchLeadTriage = readJsonFile<ResearchLeadTriageReport>(repoRoot, 'outputs/research/latest_lead_triage.json');
  const researchSourceRetrieval = readJsonFile<ResearchSourceRetrievalReport>(repoRoot, 'outputs/research/latest_source_retrieval.json');
  const researchBaselineCompletion = readJsonFile<ResearchBaselineCompletionReport>(repoRoot, 'outputs/research/latest_baseline_completion.json');
  const topicDiscoveryProposals = readJsonFile<import('@/features/narrative/types/topic_discovery').TopicDiscoveryProposal[]>(repoRoot, 'outputs/intake/latest_topic_discovery_proposals.json') ?? [];
  const evidenceChain = readJsonFile<import('@/features/evidence/types/evidence_chain').EvidenceChainEntry[]>(repoRoot, 'outputs/intake/latest_evidence_chain.json') ?? [];
  const providerConfig = intakeAgentConfigFromEnv(process.env);
  const runMode = process.env.NARRATIVE_RUN_MODE === 'research' || process.env.NARRATIVE_RUN_MODE === 'test'
    ? process.env.NARRATIVE_RUN_MODE
    : 'unlabeled';
  const pilot = readJsonFile<{ generated_at?: string; run_id?: string }>(repoRoot, 'outputs/pilot/latest_research_ledger.json');
  const replay = readJsonFile<{ generated_at?: string; run_id?: string }>(repoRoot, 'outputs/replay/latest_replay_ledger.json');
  const researchAgent = useCases
    ? {
        enabled: useCases.researchAgentRepository.readSchedulerConfig().enabled,
        loop_running: useCases.researchAgentScheduler.running,
        next_daily_run: useCases.researchAgentScheduler.nextDailyRun(),
        last_run: readJsonFile<import('@/features/research/types/research_agent').ResearchAgentRunManifest>(repoRoot, 'outputs/research_agent/latest_run.json'),
        run_history: useCases.researchAgentRepository.listRunManifests(),
        evolution: useCases.researchAgentRepository.readEvolutionLedger(),
        scheduler: useCases.researchAgentRepository.readSchedulerConfig(),
        graph_promotion: graphPromotion,
        web_research: webResearch,
        research_campaign: researchCampaign,
        direct_source_research: directSourceResearch,
        research_lead_triage: researchLeadTriage,
        research_source_retrieval: researchSourceRetrieval,
        research_baseline_completion: researchBaselineCompletion,
      }
    : null;
  return buildNarrativeMonitor({
    snapshot,
    weekly,
    diff,
    review,
    unresolvedCount: topicAudit?.unresolved_queue?.length ?? 0,
    learningProfileVersion: learning?.profile_version ?? null,
    learningCycle,
    runtime: {
      latestRun,
      recentRuns: readRecentRunManifests(repoRoot),
      runMode,
      providerConfigured: providerConfig.provider !== 'disabled' && Boolean(providerConfig.endpoint && providerConfig.apiKey),
      providerName: providerConfig.provider,
      agentAudit,
      agentVerification,
      intakeSession,
      topicAudit,
      sourceInventory,
      sourceSync,
      applyResult,
      researchAgent,
      graphPromotion,
      webResearch,
      researchCampaign,
      directSourceResearch,
      researchLeadTriage,
      researchSourceRetrieval,
      researchBaselineCompletion,
      topicDiscoveryProposals,
      evidenceChain,
      artifactTimes: [
        { artifact_type: 'weekly', generated_at: weekly?.generated_at ?? null, run_id: weekly?.run_id ?? null },
        { artifact_type: 'diff', generated_at: diff?.generated_at ?? null, run_id: diff?.run_id ?? null },
        { artifact_type: 'review', generated_at: review?.generated_at ?? null, run_id: review?.run_id ?? null },
        { artifact_type: 'pilot', generated_at: pilot?.generated_at ?? null, run_id: pilot?.run_id ?? null },
        { artifact_type: 'replay', generated_at: replay?.generated_at ?? null, run_id: replay?.run_id ?? null },
      ],
      now: new Date().toISOString(),
    },
  });
}

function readRecentRunManifests(repoRoot: string): RunManifest[] {
  const directory = resolve(repoRoot, 'outputs/runs');
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.startsWith('run_'))
    .flatMap((name) => {
      const manifest = readJsonFile<RunManifest>(repoRoot, `outputs/runs/${name}/run_manifest.json`);
      return manifest ? [manifest] : [];
    })
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, 30);
}

function readCurrentSnapshot(repoRoot: string): StageSnapshotHistory | null {
  const operational = readJsonFile<StageSnapshotHistory>(repoRoot, 'outputs/operator_runs/latest_stage_snapshot.json');
  if (operational) return operational;
  const latestRun = readJsonFile<{ run_id?: string }>(repoRoot, 'outputs/runs/latest_run.json');
  const baseline = latestRun?.run_id
    ? readJsonFile<StageSnapshotHistory>(repoRoot, `outputs/runs/${latestRun.run_id}/stage_snapshot.json`)
    : null;
  return baseline;
}

function readJsonFile<T = unknown>(repoRoot: string, relativePath: string): T | null {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function html(response: ServerResponse, body: string): void {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(body);
}

function json(response: ServerResponse, body: unknown): void {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

async function readMultipartFile(request: IncomingMessage): Promise<{ fileName: string; body: Buffer }> {
  const contentType = request.headers['content-type'] ?? '';
  const boundary = /boundary=([^;]+)/.exec(contentType)?.[1];
  if (!boundary) throw new Error('upload requires multipart boundary');
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('latin1');
  const part = raw.split(`--${boundary}`).find((item) => item.includes('filename='));
  if (!part) throw new Error('upload requires a file field');
  const headerEnd = part.indexOf('\r\n\r\n');
  const headers = part.slice(0, headerEnd);
  const fileName = /filename="([^"]+)"/.exec(headers)?.[1] ?? 'upload.txt';
  const content = part.slice(headerEnd + 4).replace(/\r\n$/, '');
  return { fileName, body: Buffer.from(content, 'latin1') };
}

function writeUpload(repoRoot: string, fileName: string, body: Buffer): string {
  const safeName = basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, '_');
  const relativePath = `outputs/intake/uploads/${Date.now()}_${safeName}`;
  const path = resolve(repoRoot, relativePath);
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, body);
  return relativePath;
}

function renderInteractiveWorkbench(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>研究材料智能解析</title>
  <style>
    :root { color-scheme: light; --ink: #18232f; --muted: #627181; --subtle: #8794a1; --line: #d9e0e6; --panel: #f4f6f7; --canvas: #e9edf0; --surface: #ffffff; --accent: #176b63; --accent-strong: #0f514b; --accent-soft: #e3f2ef; --warn: #9a5b00; --warn-soft: #fff3d7; --danger: #a43c32; --danger-soft: #fbe9e7; --focus: #1d75b9; --radius: 8px; --radius-sm: 5px; --shadow: 0 1px 2px rgba(24,35,47,.06), 0 5px 16px rgba(24,35,47,.05); }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--canvas); }
    button, select, input, textarea { font: inherit; }
    header.topbar { min-height: 64px; display: flex; align-items: center; gap: 18px; padding: 0 24px; background: #173b42; color: white; }
    .brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .brand-mark { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.34); border-radius: 6px; color: #bfe8df; font-weight: 800; }
    header h1 { font-size: 17px; margin: 0; font-weight: 720; letter-spacing: 0; }
    .trust-badge { display: inline-flex; align-items: center; gap: 7px; border: 1px solid rgba(255,255,255,.24); border-radius: 999px; padding: 6px 10px; color: #d8efea; font-size: 12px; white-space: nowrap; }
    .trust-badge::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #72c7ae; }
    .app-nav { display: flex; align-items: stretch; align-self: stretch; gap: 4px; flex: 1; min-width: 0; }
    .app-nav a { display: flex; align-items: center; flex: 0 0 auto; padding: 0 9px; color: #c8d8d9; text-decoration: none; border-bottom: 3px solid transparent; font-size: 13px; font-weight: 700; white-space: nowrap; }
    .app-nav a:hover, .app-nav a.active { color: #fff; border-bottom-color: #7ed0bc; }
    .intake-action { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; padding: 0 12px; border: 1px solid #7ed0bc; border-radius: 5px; background: var(--accent-soft); color: var(--accent-strong); text-decoration: none; font-size: 12px; font-weight: 800; white-space: nowrap; }
    .intake-action:hover { background: #fff; }
    .workflow { display: flex; align-items: center; gap: 0; padding: 12px 24px; background: var(--surface); border-bottom: 1px solid var(--line); }
    .step { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; font-weight: 650; }
    .step + .step::before { content: '›'; margin: 0 14px; color: #aab5bf; font-size: 18px; font-weight: 400; }
    .step-number { width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid #b9c6cf; border-radius: 50%; color: var(--muted); font-size: 11px; }
    .step.active { color: var(--accent-strong); }
    .step.active .step-number { background: var(--accent); border-color: var(--accent); color: white; }
    main { display: grid; grid-template-columns: minmax(400px, 46%) minmax(460px, 1fr); height: calc(100vh - 113px); min-height: 580px; }
    .left, .right { min-width: 0; overflow: auto; padding: 22px 24px 40px; }
    .left { background: var(--surface); border-right: 1px solid var(--line); }
    .right { background: var(--panel); }
    .section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .section-heading h2 { margin: 0; font-size: 18px; letter-spacing: 0; }
    .section-heading p { margin: 0; color: var(--muted); font-size: 12px; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
    .toolbar .drop { flex: 1 1 280px; }
    .drop { border: 1px dashed #86a6a2; border-radius: var(--radius); padding: 13px 14px; background: #f5fbf9; min-height: 60px; color: #3d5c5a; }
    textarea { width: 100%; min-height: 92px; resize: vertical; }
    button, select, input, textarea { border: 1px solid #b9c5ce; border-radius: var(--radius-sm); padding: 8px 10px; background: var(--surface); color: var(--ink); }
    button { cursor: pointer; white-space: nowrap; font-weight: 650; }
    button:disabled { opacity: .55; cursor: not-allowed; }
    button:hover:not(:disabled) { border-color: #78918f; background: #f8fbfa; }
    button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible { outline: 3px solid rgba(29,117,185,.25); outline-offset: 1px; border-color: var(--focus); }
    button.primary { background: var(--accent); border-color: var(--accent); color: white; }
    button.primary:hover:not(:disabled) { background: var(--accent-strong); border-color: var(--accent-strong); }
    button.secondary { background: var(--accent-soft); border-color: #acd4cb; color: var(--accent-strong); }
    button.danger { color: var(--danger); }
    .automation-status { display: grid; gap: 5px; margin: 0 0 14px; padding: 11px 13px; border: 1px solid #b9ddd5; border-radius: var(--radius); background: var(--accent-soft); color: #155b53; font-size: 12px; }
    .automation-status strong { color: var(--ink); }
    .automation-status.pending { border-color: #e3c986; background: var(--warn-soft); color: #80530a; }
    .advanced-tools { margin: 0 0 12px; color: var(--muted); font-size: 12px; }
    .advanced-tools summary { cursor: pointer; font-weight: 700; color: var(--muted); }
    .advanced-tools .toolbar { margin: 9px 0 0; }
    .source-wrap { border-top: 1px solid var(--line); padding-top: 16px; }
    .source { white-space: pre-wrap; line-height: 1.72; font-size: 14px; color: #283743; }
    .source-chunk { margin: 0 0 12px; padding-bottom: 12px; border-bottom: 1px solid #edf0f2; }
    mark { background: #ffe5a6; box-shadow: 0 0 0 2px #ffe5a6; border-radius: 2px; padding: 1px 2px; }
    .chunk-label { display: inline-block; margin: 16px 0 5px; color: var(--subtle); font-size: 11px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; }
    .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); margin-bottom: 14px; padding: 16px; box-shadow: var(--shadow); }
    .card > header { height: auto; padding: 0 0 11px; background: transparent; color: var(--ink); display: flex; gap: 10px; align-items: start; border-bottom: 1px solid #edf0f2; }
    .card h2 { font-size: 15px; line-height: 1.35; margin: 0; flex: 1; }
    .quote { margin: 13px 0; border-left: 3px solid #d0a34b; padding: 8px 0 8px 12px; color: #40515d; font-size: 13px; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    label { display: grid; gap: 5px; font-size: 11px; color: var(--muted); }
    label span { color: var(--ink); font-size: 12px; font-weight: 700; }
    .wide { grid-column: 1 / -1; }
    .layers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; font-size: 12px; color: var(--ink); }
    .layers label { display: flex; gap: 4px; align-items: center; color: var(--ink); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--line); margin: 0 0 14px; padding: 14px 0 0; }
    .small { color: var(--muted); font-size: 12px; }
    .impact { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 13px 14px; margin-bottom: 14px; box-shadow: var(--shadow); line-height: 1.7; }
    .impact-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-weight: 750; }
    .metric-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; color: var(--muted); font-size: 12px; }
    .metric-grid b { color: var(--ink); font-weight: 700; }
    .status { color: var(--warn); }
    .agent-panel { background: var(--accent-soft); border-left: 3px solid var(--accent); padding: 10px 12px; margin: 13px 0; line-height: 1.6; font-size: 12px; }
    .comparison { margin: 13px 0; padding: 10px 0; border-top: 1px solid #edf0f2; border-bottom: 1px solid #edf0f2; color: var(--muted); font-size: 12px; line-height: 1.65; }
    .comparison strong { color: var(--ink); }
    .card details { margin: 12px 0; }
    .card details summary { cursor: pointer; color: var(--accent-strong); font-size: 12px; font-weight: 750; }
    .field-help { color: var(--subtle); font-size: 11px; line-height: 1.45; }
    .technical-details { margin-top: 9px; color: var(--muted); font-size: 11px; }
    .technical-details summary { cursor: pointer; color: var(--accent-strong); font-weight: 700; }
    .technical-details code { display: block; margin-top: 7px; padding: 8px 9px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: #f6f8f9; color: #52636f; overflow-wrap: anywhere; white-space: normal; }
    .right > .section-heading { margin-bottom: 15px; }
    .right > .section-heading h2::before { content: '02'; display: inline-grid; place-items: center; width: 23px; height: 23px; margin-right: 8px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 11px; vertical-align: 2px; }
    .left > .section-heading h2::before { content: '01'; display: inline-grid; place-items: center; width: 23px; height: 23px; margin-right: 8px; border-radius: 50%; background: #d0a34b; color: #fff; font-size: 11px; vertical-align: 2px; }
    @media (max-width: 900px) { main { grid-template-columns: minmax(320px, 42%) minmax(380px, 1fr); } .left, .right { padding-left: 16px; padding-right: 16px; } header.topbar { padding: 0 16px; } .workflow { padding-left: 16px; padding-right: 16px; } .trust-badge { display: none; } }
    @media (max-width: 720px) { header.topbar { min-height: auto; padding: 10px 14px; flex-wrap: wrap; } .app-nav { order: 3; width: 100%; height: 34px; justify-content: space-between; } .app-nav a { padding: 0 5px; font-size: 11px; } .intake-action { margin-left: auto; } .workflow { overflow-x: auto; } .step { min-width: max-content; } main { display: block; height: auto; min-height: 0; } .left, .right { overflow: visible; border-right: 0; } .right { border-top: 1px solid var(--line); } .toolbar { align-items: stretch; } .toolbar button { flex: 1 1 140px; } .toolbar .drop { flex-basis: 100%; } }
    @media (max-width: 480px) { header h1 { font-size: 15px; } .brand h1 { display: none; } .brand-mark { display: grid; } .workflow { justify-content: space-between; overflow: visible; padding: 12px 13px; } .step { min-width: 0; gap: 4px; font-size: 11px; } .step + .step::before { margin: 0 3px; font-size: 15px; } .step-number { width: 20px; height: 20px; } .grid { grid-template-columns: 1fr; } .wide { grid-column: auto; } .metric-grid { grid-template-columns: 1fr; } .card { padding: 13px; } .card > header { flex-direction: column; } .card > header select { width: 100%; } .left, .right { padding: 16px 13px 28px; } }
  </style>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/" style="color:white;text-decoration:none"><div class="brand-mark" aria-hidden="true">N</div><h1>叙事生命周期 · 研究材料智能解析</h1></a>
    <nav class="app-nav" aria-label="主导航"><a href="/">总览</a><a href="/changes">变化</a><a href="/topics">主题</a><a href="/queue">研究队列</a><a href="/agent">Agent 状态</a><a href="/system">系统</a></nav>
    <a class="intake-action" href="/intake" aria-current="page">＋ 录入材料</a>
    <div class="trust-badge">研究者确认模式</div>
  </header>
  <nav class="workflow" aria-label="研究流程">
    <div class="step active"><span class="step-number">1</span>录入材料</div>
    <div class="step"><span class="step-number">2</span>拆解事实</div>
    <div class="step"><span class="step-number">3</span>审核后导入</div>
    <div class="step"><span class="step-number">4</span>查看变化</div>
  </nav>
  <main>
    <section class="left">
      <div class="section-heading"><h2>原文与引用</h2><p>先确认事实，再判断归属</p></div>
      <div class="toolbar">
        <div class="drop" id="drop">拖拽 TXT/MD/HTML/DOCX/文本型 PDF 到这里，或在下方粘贴文本。</div>
        <input id="fileInput" type="file" accept=".txt,.md,.markdown,.html,.htm,.docx,.pdf" hidden>
        <button id="chooseFileButton" title="选择本地材料">选择文件</button>
        <button class="primary" id="analyzeButton" title="自动完成原文解析、候选事实拆解、主题归属和安全校验">智能解析材料</button>
      </div>
      <textarea id="paste" aria-label="粘贴原文" placeholder="粘贴原文，然后点击“智能解析材料”"></textarea>
      <div class="automation-status pending" id="automationStatus"><strong>自动化流程待开始</strong><span>粘贴或选择材料后，系统会依次解析原文、拆解事实、对照智能分析、判断主题归属，并验证引用与安全边界。</span></div>
      <details class="advanced-tools"><summary>高级操作</summary><div class="toolbar"><button class="secondary" id="aiButton" title="重新运行规则与智能分析差异">重新运行智能对照</button><button class="secondary" id="agentButton" title="重新运行智能解析，识别核心主题与细分方向">重新运行智能解析</button><button id="topicButton" title="重新检查主题、别名、分支与旧主题重新活跃">重新检查主题归属</button></div></details>
      <div class="source-wrap"><div id="source" class="source"></div></div>
    </section>
    <section class="right">
      <div class="section-heading"><h2>候选事实审核</h2><p>每张卡只代表一个可核验事实</p></div>
      <div class="impact" id="impact">等待导入结果。</div>
      <div class="actions">
        <button class="primary" id="applyButton">验证并导入</button>
        <button class="primary" id="retryButton" hidden>重试研究更新</button>
        <button id="evaluateButton">评估反馈</button>
        <button class="secondary" id="learnButton">运行学习周期</button>
      </div>
      <p class="small">新主题与分支先形成待审核提案；接受、修改或拆分都会留下记录。</p>
      <div id="cards"></div>
    </section>
  </main>
  <script>
    let state = {};
    let selectedFile = null;
    let automation = null;
    let reviewStartedAt = new Date().toISOString();
    const layers = ['name','capital','pricing','reality','momentum','friction','data_confidence'];
    const $ = (id) => document.getElementById(id);
    const escapeHtml = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

    $('drop').addEventListener('dragover', (event) => { event.preventDefault(); $('drop').style.background = '#edf6ff'; });
    $('drop').addEventListener('dragleave', () => { $('drop').style.background = '#f9fbfd'; });
    $('drop').addEventListener('drop', (event) => {
      event.preventDefault();
      selectedFile = event.dataTransfer.files[0];
      $('drop').textContent = selectedFile ? selectedFile.name : '未选择文件';
      $('drop').style.background = '#f9fbfd';
    });
    $('chooseFileButton').onclick = () => $('fileInput').click();
    $('fileInput').addEventListener('change', (event) => {
      selectedFile = event.target.files[0] ?? null;
      $('drop').textContent = selectedFile ? selectedFile.name : '未选择文件';
    });
    $('analyzeButton').onclick = async () => runAutomation();
    $('aiButton').onclick = async () => postJson('/api/ai-shadow', {});
    $('agentButton').onclick = async () => postJson('/api/intake-agent', {});
    $('topicButton').onclick = async () => postJson('/api/topic-validate', {});
    $('applyButton').onclick = async () => postJson('/api/apply', { session_id: state.session?.session_id, decisions: collectDecisions() });
    $('retryButton').onclick = async () => postJson('/api/retry-weekly', { session_id: state.session?.session_id });
    $('evaluateButton').onclick = async () => postJson('/api/evaluate', {});
    $('learnButton').onclick = async () => postJson('/api/learn', {});

    async function postJson(url, body) {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      await handle(response);
    }
    async function postForm(url, body) {
      const response = await fetch(url, { method: 'POST', body });
      await handle(response);
    }
    async function handle(response) {
      const data = await response.json();
      if (!response.ok || data.error) { setAutomationError(data.error || 'request failed'); return alert(friendlyError(data.error || 'request failed')); }
      state = data.state ?? data;
      automation = data.automation ?? automation;
      render();
    }
    async function runAutomation() {
      setAutomationPending();
      if (selectedFile) {
        const form = new FormData();
        form.append('file', selectedFile);
        return postForm('/api/upload', form);
      }
      const text = $('paste').value.trim();
      if (!text) return alert('请先粘贴材料或选择文件。');
      return postJson('/api/prepare-text', { text });
    }
    function setAutomationPending() {
      $('automationStatus').className = 'automation-status pending';
      $('automationStatus').innerHTML = '<strong>正在智能解析</strong><span>正在执行：解析原文 → 拆解事实 → 智能分析对照 → 主题与分支归属 → 引用与安全校验。</span>';
    }
    function setAutomationError(message) {
      $('automationStatus').className = 'automation-status pending';
      $('automationStatus').innerHTML = '<strong>自动化流程未完成</strong><span>' + friendlyError(message) + '</span><details class="technical-details"><summary>技术详情</summary><code>' + escapeHtml(message) + '</code></details>';
    }
    async function load() {
      const response = await fetch('/api/state');
      state = await response.json();
      render();
    }
    function render() {
      const session = state.session;
      if (!session) return;
      renderSource(session);
      renderCards(session, state.topic_audit, state);
      renderImpact(state);
      renderAutomation();
    }
    function renderAutomation() {
      if (!automation?.steps) return;
      $('automationStatus').className = 'automation-status';
      $('automationStatus').innerHTML = '<strong>智能解析已完成</strong><span>' + automation.steps.map((step) => '✓ ' + automationStepDisplay(step)).join('　') + '</span><span>候选已完成引用与安全校验，尚未形成正式证据。点击「验证并导入」后仍需研究者确认。</span>';
    }
    function renderSource(session) {
      const chunks = session.chunks ?? [];
      if (!chunks.length) {
        $('source').innerHTML = escapeHtml(session.raw_document.text);
        return;
      }
      $('source').innerHTML = chunks.map((chunk, index) => {
        let text = escapeHtml(chunk.text);
        for (const p of session.provenance_records ?? []) {
          if (chunk.text.includes(p.quote)) {
            text = text.replace(escapeHtml(p.quote), '<mark title="' + escapeHtml(p.location_label) + '">' + escapeHtml(p.quote) + '</mark>');
          }
        }
        return '<span class="chunk-label">第 1 页 · 第 ' + (index + 1) + ' 段</span><div class="source-chunk">' + text + '</div>';
      }).join('');
    }
    function renderCards(session, audit, appState) {
      const resolutions = new Map((audit?.resolutions ?? []).map((item) => [item.candidate_id, item]));
      $('cards').innerHTML = (session.candidates ?? []).map((candidate) => cardHtml(candidate, resolutions.get(candidate.candidate_id), session, appState)).join('');
    }
    function automationStepDisplay(value) {
      return escapeHtml(({
        '文档解析': '解析原文',
        '规则候选': '拆解候选事实',
        'AI Shadow 对照': '智能分析对照',
        'Topic/Branch 检查': '主题与分支归属',
        '引用与安全校验': '引用与安全校验'
      })[value] ?? value);
    }
    function friendlyError(value) {
      const message = String(value ?? '');
      if (message.includes('stale') || message.includes('session')) return '页面内容已经更新，请刷新后重新审核。';
      if (message.includes('unresolved') || message.includes('provisional')) return '新主题与分支只会形成待审核提案，请确认归属后再继续。';
      if (message.includes('multipart') || message.includes('boundary')) return '文件上传格式不正确，请重新选择文件。';
      if (message.includes('file field')) return '没有读取到文件，请重新选择。';
      if (message.includes('pipeline retry')) return '无法确认需要重试的材料批次，请刷新页面。';
      return '操作未完成，请重试或展开技术详情查看原因。';
    }
    function operatorText(value) {
      const text = String(value ?? '');
      const exact = {
        'Topic/branch evidence is too ambiguous; operator must resolve before import.': '主题或分支归属仍需研究者确认。',
        'External signal may be relevant to a narrative, but Topic, Branch and lifecycle impact remain unresolved.': '这条外部信号可能与某个研究主题有关，但核心主题、细分分支及生命周期影响仍待确认。',
        'Candidate was generated from source text and requires human confirmation.': '该候选由原文生成，需研究者确认后才能进入导入流程。',
        'Branch evidence cannot upgrade parent narrative by itself.': '细分分支证据不能单独推动整体主题升级。',
        'AI shadow mode is advisory only and cannot import evidence.': '智能分析用于识别核心主题与细分方向，并与规则候选对照。'
      };
      if (exact[text]) return exact[text];
      const normalized = text.match(/^Structured API record normalized by (.+?) (.+?); upstream verification and human review remain required\\. Payload hash: (.+)\\.$/);
      if (normalized) return '该记录由 ' + normalized[1] + ' ' + normalized[2] + ' 完成格式规范化，并自动通过引用校验。原始载荷哈希：' + normalized[3] + '。';
      return text;
    }
    function resolutionDisplay(value) {
      return ({
        existing_topic: '已匹配现有主题',
        alias_of: '已识别主题别名',
        new_branch: '建议建立新分支',
        reactivation: '旧主题重新活跃',
        new_provisional_topic: '新主题（待审核）',
        unresolved: '暂时无法判断',
        not_checked: '尚未检查'
      })[value] ?? '未知归属状态';
    }
    function evidenceStrengthDisplay(value) {
      return ({
        E0: 'E0 · 线索',
        E1: 'E1 · 单一可信来源',
        E2: 'E2 · 多方印证',
        E3: 'E3 · 官方行动或真实落地',
        E4: 'E4 · 可验证的持续结果'
      })[value] ?? '未知证据等级';
    }
    function layerDisplay(value) {
      return ({
        name: '认知与命名',
        capital: '资金与资源',
        pricing: '市场预期',
        reality: '现实进展',
        momentum: '发展动能',
        friction: '阻力与风险',
        data_confidence: '信息完整度'
      })[value] ?? '未知影响维度';
    }
    function optionDisplay(name, value) {
      const common = {
        rule: '采用规则建议',
        agent: '采用智能解析建议',
        merge: '合并两种建议',
        manual: '完全手动填写',
        unresolved: '暂时无法判断',
        parent: '影响整体主题',
        branch: '仅影响此细分分支',
        low: '低',
        medium: '中',
        high: '高',
        existing_topic: '已匹配现有主题',
        alias_of: '主题别名',
        new_branch: '新分支',
        reactivation: '旧主题重新活跃',
        new_provisional_topic: '新主题（待审核）'
      };
      if (name === 'evidence_strength') return evidenceStrengthDisplay(value);
      return common[value] ?? '未知选项';
    }
    function priorityDisplay(value) { return ({ high: '高', medium: '中', low: '低' })[value] ?? '未标注'; }
    function importStatusDisplay(value) {
      return ({
        imported: '已导入并完成更新',
        imported_pipeline_failed: '证据已导入，研究更新待重试',
        no_evidence_imported: '未产生正式证据',
        rejected: '未导入'
      })[value] ?? (value ? '状态待确认' : '尚未导入');
    }
    function stageDisplay(value) {
      return value + ' · ' + ({
        S0: '尚未形成', S1: '零散线索', S2: '稳定命名', S3: '资源关注',
        S4: '形成预期', S5: '现实验证', S6: '规模兑现',
        S7A: '成熟延续', S7B: '走向衰退', S7C: '分支演变'
      }[value] ?? '待解释');
    }
    function cardHtml(candidate, resolution, session, appState) {
      const ev = candidate.suggested_evidence;
      const ai = (session.ai_shadow_candidates ?? []).find((item) => item.candidate_id === candidate.candidate_id);
      const comparison = (session.candidate_comparisons ?? []).find((item) => item.candidate_id === candidate.candidate_id);
      const agent = (appState.agent_candidates ?? []).find((item) => item.source_candidate_id === candidate.candidate_id);
      const agentCheck = (appState.agent_verification?.candidates ?? []).find((item) => item.agent_candidate_id === agent?.agent_candidate_id);
      const learningPriority = (appState.learning_cycle?.active_learning_queue ?? []).find((item) => item.candidate_id === candidate.candidate_id);
      const agentOnly = candidate.suggested_reason.startsWith('Agent-only fact:');
      const sourceOptions = agent ? ['rule','agent','merge','manual','unresolved'] : ['rule','merge','manual','unresolved'];
      return '<article class="card" data-candidate="' + escapeHtml(candidate.candidate_id) + '">' +
        '<header><h2>' + escapeHtml(ev.event_title) + (agentOnly ? '<div class="small">智能解析拆分出的事实</div>' : '') + '</h2><select name="decision"><option value="reject">拒绝</option><option value="accept">接受</option><option value="modify" selected>修改</option><option value="split">拆分</option></select></header>' +
        '<div class="quote">' + escapeHtml(candidate.original_quote) + '</div>' +
        (learningPriority ? '<p class="small"><b>建议优先审核：</b>' + priorityDisplay(learningPriority.priority_band) + ' · ' + escapeHtml(learningPriority.priority_score) + ' / 100</p>' : '') +
        '<p class="small"><b>主题归属建议：</b>' + escapeHtml(resolutionDisplay(resolution?.status ?? 'not_checked')) + ' · ' + escapeHtml(operatorText(resolution?.reason ?? '尚未检查主题归属')) + '</p>' +
        '<details class="comparison"><summary>查看规则与智能分析的差异</summary><div>' +
          '核心主题：' + escapeHtml(comparison?.rule_topic_id ?? ev.topic_id) + ' → ' + escapeHtml(comparison?.ai_topic_id ?? '无建议') + '<br>' +
          '细分分支：' + escapeHtml(comparison?.rule_branch_id ?? '无') + ' → ' + escapeHtml(comparison?.ai_branch_id ?? '无') + '<br>' +
          '影响范围：' + escapeHtml(optionDisplay('scope', comparison?.rule_scope ?? ev.scope)) + ' → ' + escapeHtml(optionDisplay('scope', comparison?.ai_scope ?? '无建议')) + '<br>' +
          '证据强度：' + escapeHtml(evidenceStrengthDisplay(comparison?.rule_strength ?? ev.evidence_strength)) + ' → ' + escapeHtml(evidenceStrengthDisplay(comparison?.ai_strength ?? '无建议')) + '<br>' +
          '影响维度：' + escapeHtml((comparison?.rule_layers ?? ev.affected_layer).map(layerDisplay).join('、')) + ' → ' + escapeHtml((comparison?.ai_layers ?? []).map(layerDisplay).join('、') || '无建议') + '<br>' +
          '限制说明是否不同：' + (comparison?.rule_limitation === comparison?.ai_limitation ? '否' : '是') + '<br>' +
          '<span class="small">' + escapeHtml(operatorText(comparison?.difference_summary ?? '尚未生成差异说明')) + '</span></div>' +
        '</details>' +
        '<details class="agent-panel"><summary>智能解析建议 · ' + (agent ? (agent.fallback_used ? '使用备用规则' : '已生成') : '尚未运行') + '</summary><div>' +
          (agent ? '<strong>支持事实：</strong>' + escapeHtml(agent.supported_fact) + '<br>' +
            '<strong>行业归属：</strong>' + escapeHtml(agent.industry_id ?? '暂无法判断') + ' · ' + escapeHtml(resolutionDisplay(agent.industry_status ?? 'unresolved')) + '<br>' +
            '<strong>原文引用：</strong>' + escapeHtml(agent.original_quote) + '<br>' +
            '<strong>为什么重要：</strong>' + escapeHtml(operatorText(agent.inferred_interpretation)) + '<br>' +
            '<strong>不能证明什么：</strong>' + escapeHtml(operatorText(agent.limitation)) + '<br>' +
            '<strong>安全检查：</strong>' + ((agentCheck?.status ?? agent.validation_status) === 'passed' ? '通过' : '需要复核') + '<br>' +
            '<span class="small">智能解析只生成候选；正式证据、主题登记和阶段判断必须由研究者确认。</span>' +
            '<details class="technical-details"><summary>技术详情</summary><code>' + escapeHtml(agent.provider) + ' / ' + escapeHtml(agent.model_version) + '<br>' + escapeHtml((agentCheck?.errors ?? agent.validation_errors ?? []).join('; ') || '校验通过') + '</code></details>' : '<span class="small">点击上方“重新运行智能解析”生成候选。</span>') +
        '</div></details>' +
        '<div class="grid">' +
          input('topic_id','核心主题',ev.topic_id) + input('branch_id','细分方向（可选）',ev.branch_id ?? '') +
          select('candidate_source','采用哪种建议','rule',sourceOptions) +
          select('topic_resolution_status','主题归属方式',resolution?.status ?? 'existing_topic',['existing_topic','alias_of','new_branch','reactivation','new_provisional_topic','unresolved']) +
          select('scope','影响范围',ev.scope,['parent','branch']) +
          select('evidence_strength','证据强度',ev.evidence_strength,['E0','E1','E2','E3','E4']) +
          select('confidence','信息可靠度',ev.confidence,['low','medium','high']) +
          textarea('event_title','事实标题',ev.event_title) +
          textarea('event_summary','事实摘要',ev.event_summary) +
          textarea('interpretation','为什么重要',operatorText(ev.interpretation)) +
          textarea('limitation','不能证明什么',operatorText(ev.limitation)) +
          '<label class="wide"><span>影响维度</span><div class="layers">' + layers.map((layer) => '<label><input type="checkbox" name="layer" value="' + layer + '"' + (ev.affected_layer.includes(layer) ? ' checked' : '') + '>' + layerDisplay(layer) + '</label>').join('') + '</div></label>' +
        '</div>' +
        '<p class="field-help">证据强度：E0 是待验证线索；E1 是单一可信来源；E2 需要多方独立印证；E3 需要官方行动或真实落地；E4 需要可验证、持续且有规模的结果。</p>' +
      '</article>';
    }
    function input(name, label, value) { return '<label><span>' + label + '</span><input name="' + name + '" value="' + escapeHtml(value) + '"></label>'; }
    function textarea(name, label, value) { return '<label class="wide"><span>' + label + '</span><textarea name="' + name + '">' + escapeHtml(value) + '</textarea></label>'; }
    function select(name, label, value, options) { return '<label><span>' + label + '</span><select name="' + name + '">' + options.map((opt) => '<option value="' + opt + '"' + (opt === value ? ' selected' : '') + '>' + escapeHtml(optionDisplay(name, opt)) + '</option>').join('') + '</select></label>'; }
    function collectDecisions() {
      const session = state.session;
      return Array.from(document.querySelectorAll('.card')).map((card) => {
        const candidate = session.candidates.find((item) => item.candidate_id === card.dataset.candidate);
        const ev = candidate.suggested_evidence;
        const decision = value(card, 'decision');
        const source = value(card, 'candidate_source');
        const selectedAgent = source === 'agent' ? state.agent_candidates?.find((item) => item.source_candidate_id === candidate.candidate_id) : null;
        const baseEvidence = selectedAgent?.suggested_evidence ?? ev;
        const draft = {
          ...baseEvidence,
          evidence_id: ev.evidence_id,
          topic_id: value(card, 'topic_id'),
          branch_id: value(card, 'branch_id') || null,
          scope: value(card, 'scope'),
          evidence_strength: value(card, 'evidence_strength'),
          confidence: value(card, 'confidence'),
          event_title: value(card, 'event_title'),
          event_summary: value(card, 'event_summary'),
          interpretation: value(card, 'interpretation'),
          limitation: value(card, 'limitation'),
          affected_layer: Array.from(card.querySelectorAll('input[name="layer"]:checked')).map((item) => item.value)
        };
        const reviewedAt = new Date().toISOString();
        const base = { candidate_id: candidate.candidate_id, decision: source === 'unresolved' ? 'reject' : decision, reviewer: 'interactive_operator', review_started_at: reviewStartedAt, reviewed_at: reviewedAt, review_duration_seconds: Math.max(0, Math.round((Date.parse(reviewedAt) - Date.parse(reviewStartedAt)) / 1000)), topic_resolution_status: source === 'unresolved' ? 'unresolved' : value(card, 'topic_resolution_status'), reviewer_note: 'selection=' + source };
        if (decision === 'accept') return base;
        if (decision === 'reject') return { ...base, rejection_reason: 'Rejected in interactive workbench.' };
        if (decision === 'split') return { ...base, split_evidence: [draft] };
        return { ...base, modified_evidence: draft };
      });
    }
    function value(root, name) { return root.querySelector('[name="' + name + '"]')?.value ?? ''; }
    function renderImpact(s) {
      const weekly = s.weekly_brief;
      const apply = s.apply_result;
      const evalReport = s.evaluation;
      const learningCycle = s.learning_cycle;
      const sessionTopics = Array.from(new Set((s.session?.candidates ?? []).map((candidate) => candidate.suggested_evidence.topic_id)));
      const impactedTopics = (weekly?.stage_snapshot ?? []).filter((topic) => sessionTopics.includes(topic.topic_id));
      const batchStatus = !apply
        ? '本批材料尚未导入；不会展示其他批次的研究结果。'
        : apply.import_status === 'imported_pipeline_failed'
          ? '证据已成功导入，但本轮研究更新失败；可安全重试，系统不会再次导入证据。'
          : apply.imported && apply.weekly_run_id
          ? '本批材料已导入并完成研究更新。'
          : '本批材料未产生正式证据。';
      $('retryButton').hidden = apply?.import_status !== 'imported_pipeline_failed';
      const topicRows = impactedTopics.length ? impactedTopics.map((topic) => {
        const why = (weekly?.why_not_higher ?? []).find((item) => item.topic_id === topic.topic_id);
        return '<div class="wide"><b>' + escapeHtml(topic.topic_name) + '</b> · 阶段 ' + escapeHtml(stageDisplay(topic.current_stage)) + ' · 数据可信度 ' + escapeHtml(optionDisplay('confidence', topic.data_confidence)) + '<br><span class="small">为什么不能更高：' + escapeHtml(operatorText(why?.why_not_higher_stage ?? '当前研究结果未提供')) + '</span></div>';
      }).join('') : '<span class="wide">本次候选尚未匹配到正式主题；系统不会借用其他主题的结果代替展示。</span>';
      $('impact').innerHTML =
      '<div class="impact-title"><span>导入影响</span><span class="small">' + escapeHtml(importStatusDisplay(apply?.import_status)) + '</span></div>' +
        '<div class="metric-grid">' +
        '<span>本轮研究更新 <b>' + (apply?.weekly_run_id ? '已完成' : '尚未进入') + '</b></span>' +
        '<span>更新重试次数 <b>' + escapeHtml(apply?.pipeline_retry_count ?? 0) + '</b></span>' +
        '<span>候选接受率 <b>' + escapeHtml(evalReport?.acceptance_rate ?? '待评估') + '</b></span>' +
        topicRows +
        '</div>' +
        (apply?.weekly_run_id ? '<details class="technical-details"><summary>技术详情</summary><code>研究更新编号：' + escapeHtml(apply.weekly_run_id) + '</code></details>' : '') +
        '<p class="small">' + escapeHtml(batchStatus) + '</p>' +
        (apply?.pipeline_error ? '<p class="small error">最近错误：' + escapeHtml(friendlyError(apply.pipeline_error)) + '</p>' +
          '<details class="technical-details"><summary>错误技术详情</summary><code>' + escapeHtml(apply.pipeline_error) + '</code></details>' : '') +
        '<p class="small">持续改进：已形成 ' + escapeHtml(learningCycle?.proposals?.length ?? 0) + ' 个改进建议，达到阈值后进入人工审核。</p>' +
        '<details class="technical-details"><summary>学习记录详情</summary><code>' + escapeHtml(learningCycle?.cycle_version ?? '尚未生成') + ' · ' + escapeHtml(learningCycle?.promotion_status ?? '等待样本反馈') + ' · ' + escapeHtml(s.learning_profile?.profile_version ?? '尚未生成') + '</code></details>' +
        '<p class="status">研究者确认模式：候选先校验，主题与分支先形成提案，规则改进只进入审核队列。</p>';
    }
    load();
  </script>
</body>
</html>`;
}
