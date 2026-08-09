import type { StageDiff, StageSnapshotHistory } from '@/features/stages/types/diff';
import type { OperatorReview } from '@/features/reporting/types/operator_review';
import type { WeeklyBrief } from '@/features/reporting/types/report';
import type {
  NarrativeInboxItem,
  NarrativeMonitorModel,
  NarrativeMonitorRuntimeInput,
  NarrativeReviewQueueItem,
} from '@/features/narrative/types/narrative_monitor';
import type { IntakeLearningCycle } from '@/features/intake/types/intake_learning_cycle';
import { DEFAULT_SCHEDULER_CONFIG } from '@/features/research/types/research_agent';

export function buildNarrativeMonitor(input: {
  snapshot: StageSnapshotHistory | null;
  weekly: WeeklyBrief | null;
  diff: StageDiff | null;
  review: OperatorReview | null;
  unresolvedCount: number;
  learningProfileVersion: string | null;
  learningCycle?: IntakeLearningCycle | null;
  runtime?: NarrativeMonitorRuntimeInput;
}): NarrativeMonitorModel {
  const topics = (input.snapshot?.topics ?? []).map((topic) => ({
    topic_id: topic.topic_id,
    topic_name: topic.topic_name,
    parent_narrative: topic.parent_narrative,
    current_stage: topic.current_stage,
    gate_stage: topic.gate_stage,
    data_confidence: topic.data_confidence,
    evidence_count: topic.evidence_ids.length,
    baseline_status: topic.current_stage === 'S0' && topic.evidence_ids.length === 0 ? 'baseline_required' as const : 'evidence_based' as const,
    branch_count: topic.branches.length,
    strongest_branch: topic.strongest_branch,
    weakest_layer: topic.weakest_layer,
    why_not_higher_stage: topic.why_not_higher_stage,
    gate_input: topic.gate_input ?? null,
    change: input.diff?.topic_changes.find((change) => change.topic_id === topic.topic_id) ?? null,
    branches: topic.branches,
    evidence: input.weekly?.strongest_evidence.filter((item) => item.topic === topic.topic_name) ?? [],
  }));
  const summary = input.diff?.summary;
  const runtime = input.runtime ?? {};
  const now = Date.parse(runtime.now ?? new Date().toISOString());
  const latestRun = runtime.latestRun ?? null;
  const agentAudit = runtime.agentAudit ?? null;
  const providerConfigured = runtime.providerConfigured ?? false;
  const inbox = buildInbox(runtime);
  const reviewQueue = buildReviewQueue(runtime, inbox, input.review);
  const sourceSync = runtime.sourceSync ?? null;
  const sourceSession = sourceSync?.intake_session_id
    && runtime.intakeSession?.session_id === sourceSync.intake_session_id
    ? runtime.intakeSession
    : null;
  const sourceApply = sourceSession && runtime.applyResult?.session_id === sourceSession.session_id
    ? runtime.applyResult
    : null;
  const sourceLoopStatus = !sourceSync
    ? 'not_run'
    : !sourceSync.candidate_count
      ? 'no_changes'
      : !sourceApply
        ? 'pending_review'
        : sourceApply.import_status === 'imported_pipeline_failed'
          ? 'pipeline_failed'
          : !sourceApply.imported
            ? 'reviewed_no_import'
            : sourceApply.weekly_run_id
              ? 'weekly_complete'
              : 'pipeline_failed';
  const freshness = (generatedAt: string | null): 'fresh' | 'stale' | 'missing' => {
    if (!generatedAt) return 'missing';
    return now - Date.parse(generatedAt) <= 24 * 60 * 60 * 1000 ? 'fresh' : 'stale';
  };
  const latestGeneratedAt = input.weekly?.generated_at ?? input.snapshot?.generated_at ?? null;
  const researchAgent = runtime.researchAgent ?? {};
  const scheduler = researchAgent.scheduler;
  const automaticIngestion: NarrativeMonitorModel['system']['automatic_ingestion'] = runtime.sourceInventory?.production_configured ? 'configured' : 'not_configured';
  return {
    generated_at: latestGeneratedAt,
    run_id: input.weekly?.run_id ?? input.snapshot?.run_id ?? null,
    status: topics.length ? 'ready' : 'insufficient_data',
    metrics: {
      topic_count: topics.length,
      stage_upgrade_count: summary?.stage_upgrade_count ?? 0,
      stage_downgrade_count: summary?.stage_downgrade_count ?? 0,
      evidence_added_count: summary?.evidence_added_count ?? 0,
      branch_mutation_count: summary?.branch_mutation_candidate_count ?? 0,
      low_confidence_count: topics.filter((topic) => topic.data_confidence === 'low').length,
      unresolved_candidate_count: input.unresolvedCount,
    },
    topics,
    alerts: input.review?.high_priority_operator_alerts ?? [],
    no_change_topics: input.review?.consecutive_no_change_topics ?? [],
    early_radar: input.weekly?.early_radar_candidates ?? [],
    unresolved_count: input.unresolvedCount,
    learning_profile_version: input.learningProfileVersion,
    learning_cycle: input.learningCycle ?? null,
    guardrails: input.weekly?.guardrail_check ?? null,
    system: {
      last_successful_run: latestRun?.status === 'ok' ? latestRun.completed_at : null,
      next_scheduled_run: researchAgent.next_daily_run ?? null,
      automatic_ingestion: automaticIngestion,
      provider: agentAudit?.provider ?? runtime.providerName ?? 'disabled',
      provider_state: !providerConfigured
        ? 'not_configured'
        : agentAudit?.status === 'passed'
          ? 'operational'
          : agentAudit?.status === 'failed'
            ? 'failed'
            : 'fallback',
      model_version: agentAudit?.model_version ?? null,
      prompt_version: agentAudit?.prompt_version ?? null,
      fallback_state: agentAudit?.status === 'fallback' ? 'active' : agentAudit ? 'inactive' : 'unknown',
      data_freshness: freshness(latestGeneratedAt),
      run_mode: runtime.runMode ?? 'unlabeled',
      pipeline_state: latestRun?.status === 'ok' ? 'operational' : latestRun?.status === 'failed' ? 'failed' : 'not_configured',
      guardrail_state: latestRun?.guardrail_status === 'ok' ? 'operational' : latestRun ? 'review_required' : 'not_configured',
    },
    artifacts: (runtime.artifactTimes ?? []).map((artifact) => ({
      ...artifact,
      freshness: freshness(artifact.generated_at),
    })),
    changes: input.diff?.topic_changes ?? [],
    recent_runs: (runtime.recentRuns ?? []).map((run) => ({ ...run, run_mode: runtime.runMode ?? 'unlabeled' })),
    inbox,
    review_queue: reviewQueue,
    source_inventory: runtime.sourceInventory ?? null,
    source_sync: sourceSync,
    source_loop: {
      sync_id: sourceSync?.sync_id ?? null,
      session_id: sourceSession?.session_id ?? null,
      discovered_count: sourceSync?.candidate_count ?? 0,
      pending_review_count: sourceApply ? 0 : inbox.filter((item) => item.review_status === 'pending_review').length,
      imported_count: sourceApply?.imported ? sourceApply.accepted_count : 0,
      weekly_run_id: sourceApply?.weekly_run_id ?? null,
      status: sourceLoopStatus,
    },
    research_agent: {
      enabled: researchAgent.enabled ?? false,
      loop_running: researchAgent.loop_running ?? false,
      next_daily_run: researchAgent.next_daily_run ?? null,
      last_run: researchAgent.last_run ?? null,
      run_history: researchAgent.run_history ?? [],
      evolution: researchAgent.evolution ?? null,
      scheduler: researchAgent.scheduler ?? DEFAULT_SCHEDULER_CONFIG,
      graph_promotion: researchAgent.graph_promotion ?? runtime.graphPromotion ?? null,
      web_research: researchAgent.web_research ?? runtime.webResearch ?? null,
      research_campaign: researchAgent.research_campaign ?? runtime.researchCampaign ?? null,
      direct_source_research: researchAgent.direct_source_research ?? runtime.directSourceResearch ?? null,
      research_lead_triage: researchAgent.research_lead_triage ?? runtime.researchLeadTriage ?? null,
      research_source_retrieval: researchAgent.research_source_retrieval ?? runtime.researchSourceRetrieval ?? null,
      research_baseline_completion: researchAgent.research_baseline_completion ?? runtime.researchBaselineCompletion ?? null,
    },
    topic_discovery_proposals: runtime.topicDiscoveryProposals ?? [],
    evidence_chain: runtime.evidenceChain ?? [],
  };
}

function buildInbox(runtime: NarrativeMonitorRuntimeInput): NarrativeInboxItem[] {
  const session = runtime.intakeSession;
  if (!session) return [];
  const resolutions = new Map((runtime.topicAudit?.session_id === session.session_id ? runtime.topicAudit.resolutions : []).map((item) => [item.candidate_id, item]));
  const verification = runtime.agentVerification?.session_id === session.session_id ? runtime.agentVerification : null;
  // A promotion report is bound to one Intake session. Only that matching
  // report can remove a candidate from the review queue; an older successful
  // run must never hide a newly parsed candidate with the same-looking id.
  const publicationByCandidate = new Map(
    runtime.autonomousPromotion?.session_id === session.session_id
      ? runtime.autonomousPromotion.items.map((item) => [item.candidate_id, item.decision])
      : [],
  );
  return session.candidates.map((candidate) => {
    const resolution = resolutions.get(candidate.candidate_id);
    const agentCheck = verification?.candidates.find((item) => item.agent_candidate_id.includes(candidate.candidate_id.replace('candidate_', '')));
    return {
      candidate_id: candidate.candidate_id,
      session_id: session.session_id,
      quote: candidate.original_quote,
      topic_id: candidate.suggested_evidence.topic_id,
      branch_id: candidate.suggested_evidence.branch_id ?? null,
      scope: candidate.suggested_evidence.scope,
      evidence_strength: candidate.suggested_evidence.evidence_strength,
      duplicate_of_evidence_id: candidate.duplicate_of_evidence_id ?? null,
      resolution_status: resolution?.status ?? 'not_checked',
      resolution_reason: resolution?.reason ?? 'Topic Resolver has not produced a matching audit for this session.',
      agent_status: agentCheck?.status ?? (verification ? (verification.fallback_count ? 'fallback' : verification.failed_count ? 'failed' : 'passed') : 'not_run'),
      review_status: publicationByCandidate.get(candidate.candidate_id) === 'published' ? 'auto_published' : 'pending_review',
      generated_at: session.generated_at,
    };
  });
}

function buildReviewQueue(
  runtime: NarrativeMonitorRuntimeInput,
  inbox: NarrativeInboxItem[],
  review: OperatorReview | null,
): NarrativeReviewQueueItem[] {
  const rows: NarrativeReviewQueueItem[] = [];
  const heldReasonsByCandidate = new Map<string, string[]>();
  const orphanedPublicationRows: NarrativeReviewQueueItem[] = [];

  // A policy hold is an explanation for a candidate, not a second task. Merge
  // it into the candidate row whenever the candidate is still in the Intake
  // inbox so the researcher does not have to review the same material twice.
  for (const item of runtime.autonomousPromotion?.items.filter((item) => item.decision === 'held').slice(0, 24) ?? []) {
    const reasons = item.reasons.join(' ') || '候选 Evidence 尚未通过正式发布条件。';
    if (item.candidate_id) {
      const existing = heldReasonsByCandidate.get(item.candidate_id) ?? [];
      existing.push(reasons);
      heldReasonsByCandidate.set(item.candidate_id, existing);
      continue;
    }
    orphanedPublicationRows.push({
      queue_id: `publication:${item.evidence_id}`,
      candidate_id: null,
      category: 'evidence_publication_review',
      priority: item.scope === 'parent' && /stage|parent.branch|conflict/i.test(reasons) ? 'high' : 'medium',
      title: item.branch_id ? `${item.topic_id ?? '待解析主题'} / ${item.branch_id}` : item.topic_id ?? item.evidence_id,
      reason: reasons,
      href: '/intake',
    });
  }
  for (const item of inbox.filter((candidate) => candidate.review_status !== 'auto_published')) {
    const resolutionCategory = item.resolution_status === 'new_branch'
      ? 'new_branch'
      : item.resolution_status === 'reactivation'
        ? 'reactivation'
        : item.resolution_status === 'new_provisional_topic' || item.resolution_status === 'unresolved'
          ? 'new_topic'
          : null;
    const heldReasons = heldReasonsByCandidate.get(item.candidate_id) ?? [];
    const category = item.duplicate_of_evidence_id
      ? 'possible_duplicate'
      : item.scope === 'branch' && !item.branch_id
        ? 'parent_branch_conflict'
        : ['E3', 'E4'].includes(item.evidence_strength)
          ? 'high_strength'
          : resolutionCategory ?? (heldReasons.length ? 'evidence_publication_review' : 'ordinary_candidate');
    rows.push({
      queue_id: `candidate:${item.candidate_id}`,
      candidate_id: item.candidate_id,
      category,
      priority: ['parent_branch_conflict', 'high_strength'].includes(category) ? 'high' : category === 'ordinary_candidate' ? 'low' : 'medium',
      title: `${item.topic_id} · ${item.evidence_strength}`,
      reason: [item.duplicate_of_evidence_id
        ? `Possible duplicate of ${item.duplicate_of_evidence_id}.`
        : item.resolution_reason, ...heldReasons].filter(Boolean).join(' '),
      href: `/intake?candidate=${encodeURIComponent(item.candidate_id)}`,
    });
  }
  for (const [candidateId, reasons] of heldReasonsByCandidate) {
    if (inbox.some((item) => item.candidate_id === candidateId)) continue;
    rows.push({
      queue_id: `publication:${candidateId}`,
      candidate_id: candidateId,
      category: 'evidence_publication_review',
      priority: 'medium',
      title: '待确认候选',
      reason: reasons.join(' '),
      href: `/intake?candidate=${encodeURIComponent(candidateId)}`,
    });
  }
  rows.push(...orphanedPublicationRows);
  const priority = { high: 0, medium: 1, low: 2 };
  return rows.sort((a, b) => priority[a.priority] - priority[b.priority]);
}

function chainRelationLabel(value: string): string {
  return ({ supports: '支持', contradicts: '反向', updates: '更新', duplicates: '重复', branch_only: '仅分支', fills_gap: '补充缺口' } as Record<string, string>)[value] ?? value;
}
