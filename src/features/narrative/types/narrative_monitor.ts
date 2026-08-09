import type { StageSnapshotHistory, TopicChange } from '@/features/stages/types/diff';
import type { OperatorReview } from '@/features/reporting/types/operator_review';
import type { WeeklyBrief, WeeklyBriefEvidenceItem } from '@/features/reporting/types/report';
import type { IntakeLearningCycle } from '@/features/intake/types/intake_learning_cycle';
import type { EvidenceIntakeApplyResult, EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { IntakeAgentAudit, IntakeAgentVerificationReport } from '@/features/intake/types/intake_agent';
import type { RunManifest } from '@/platform/types/run_context';
import type { TopicResolutionAudit } from '@/features/narrative/types/topic_resolution';
import type { WorldMonitorSourceInventory, WorldMonitorSyncReport } from '@/features/worldmonitor/types/worldmonitor_adapter';
import type { ResearchAgentEvolutionLedger, ResearchAgentRunManifest, ResearchAgentSchedulerConfig } from '@/features/research/types/research_agent';
import type { EvidenceChainEntry } from '@/features/evidence/types/evidence_chain';
import type { TopicDiscoveryProposal } from '@/features/narrative/types/topic_discovery';
import type { NarrativeGraphPromotionReport } from '@/features/narrative/types/narrative_graph_promotion';
import type { WebResearchReport } from '@/features/research/types/web_research';
import type { ResearchCampaign } from '@/features/research/types/research_coverage';
import type { DirectSourceResearchReport } from '@/features/research/types/direct_source_research';
import type { ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';
import type { ResearchBaselineCompletionReport } from '@/features/research/types/research_baseline_completion';
import type { AutonomousPromotionReport } from '@/features/research/types/autonomous_research';

export interface NarrativeMonitorTopic {
  topic_id: string;
  topic_name: string;
  parent_narrative: string;
  current_stage: string;
  gate_stage: string;
  data_confidence: 'low' | 'medium' | 'high';
  evidence_count: number;
  /** S0 without parent evidence is an evidence-baseline gap, not a claim that
   * the external market is necessarily early. */
  baseline_status: 'evidence_based' | 'baseline_required';
  branch_count: number;
  strongest_branch: string;
  weakest_layer: string;
  why_not_higher_stage: string;
  /** The four quantitative stage gates plus independent-source count, forwarded
   * for the topic detail radar. Null when no parent Evidence Table exists. */
  gate_input: import('@/features/stages/domain/stages').StageGateInput | null;
  change: TopicChange | null;
  branches: StageSnapshotHistory['topics'][number]['branches'];
  evidence: WeeklyBriefEvidenceItem[];
}

export interface NarrativeMonitorModel {
  generated_at: string | null;
  run_id: string | null;
  status: 'ready' | 'insufficient_data';
  metrics: {
    topic_count: number;
    stage_upgrade_count: number;
    stage_downgrade_count: number;
    evidence_added_count: number;
    branch_mutation_count: number;
    low_confidence_count: number;
    unresolved_candidate_count: number;
  };
  topics: NarrativeMonitorTopic[];
  alerts: OperatorReview['high_priority_operator_alerts'];
  no_change_topics: OperatorReview['consecutive_no_change_topics'];
  early_radar: WeeklyBrief['early_radar_candidates'];
  unresolved_count: number;
  learning_profile_version: string | null;
  learning_cycle: IntakeLearningCycle | null;
  guardrails: WeeklyBrief['guardrail_check'] | null;
  system: NarrativeSystemStatus;
  artifacts: NarrativeArtifactStatus[];
  changes: TopicChange[];
  recent_runs: NarrativeRunStatus[];
  inbox: NarrativeInboxItem[];
  review_queue: NarrativeReviewQueueItem[];
  source_inventory: WorldMonitorSourceInventory | null;
  source_sync: WorldMonitorSyncReport | null;
  source_loop: {
    sync_id: string | null;
    session_id: string | null;
    discovered_count: number;
    pending_review_count: number;
    imported_count: number;
    weekly_run_id: string | null;
    status: 'not_run' | 'no_changes' | 'pending_review' | 'reviewed_no_import' | 'pipeline_failed' | 'weekly_complete';
  };
  research_agent: NarrativeResearchAgentStatus;
  topic_discovery_proposals: TopicDiscoveryProposal[];
  evidence_chain: EvidenceChainEntry[];
}

export interface NarrativeResearchAgentStatus {
  enabled: boolean;
  loop_running: boolean;
  next_daily_run: string | null;
  last_run: ResearchAgentRunManifest | null;
  run_history: ResearchAgentRunManifest[];
  evolution: ResearchAgentEvolutionLedger | null;
  scheduler: ResearchAgentSchedulerConfig;
  graph_promotion: NarrativeGraphPromotionReport | null;
  web_research: WebResearchReport | null;
  research_campaign: ResearchCampaign | null;
  direct_source_research: DirectSourceResearchReport | null;
  research_lead_triage: ResearchLeadTriageReport | null;
  research_source_retrieval: ResearchSourceRetrievalReport | null;
  research_baseline_completion: ResearchBaselineCompletionReport | null;
}

export type OperationalState =
  | 'operational'
  | 'review_required'
  | 'fallback'
  | 'failed'
  | 'stale'
  | 'not_configured'
  | 'unlabeled';

export interface NarrativeSystemStatus {
  last_successful_run: string | null;
  next_scheduled_run: string | null;
  automatic_ingestion: 'configured' | 'not_configured';
  provider: string;
  provider_state: OperationalState;
  model_version: string | null;
  prompt_version: string | null;
  fallback_state: 'active' | 'inactive' | 'unknown';
  data_freshness: 'fresh' | 'stale' | 'missing';
  run_mode: 'research' | 'test' | 'unlabeled';
  pipeline_state: OperationalState;
  guardrail_state: OperationalState;
}

export interface NarrativeArtifactStatus {
  artifact_type: 'weekly' | 'review' | 'pilot' | 'replay' | 'diff';
  generated_at: string | null;
  run_id: string | null;
  freshness: 'fresh' | 'stale' | 'missing';
}

export interface NarrativeRunStatus extends RunManifest {
  run_mode: 'research' | 'test' | 'unlabeled';
}

export interface NarrativeInboxItem {
  candidate_id: string;
  session_id: string;
  quote: string;
  topic_id: string;
  branch_id: string | null;
  scope: string;
  evidence_strength: string;
  duplicate_of_evidence_id: string | null;
  resolution_status: string;
  resolution_reason: string;
  agent_status: 'passed' | 'failed' | 'fallback' | 'not_run';
  review_status: 'pending_review' | 'reviewed';
  generated_at: string;
}

export interface NarrativeReviewQueueItem {
  queue_id: string;
  candidate_id: string | null;
  category:
    | 'parent_branch_conflict'
    | 'high_strength'
    | 'new_topic'
    | 'new_branch'
    | 'reactivation'
    | 'agent_rule_disagreement'
    | 'low_citation_confidence'
    | 'possible_duplicate'
    | 'unsupported_claim'
    | 'ordinary_candidate'
    | 'guardrail_alert'
    | 'topic_discovery'
    | 'evidence_chain_update'
    | 'evidence_publication_review';
  priority: 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  href: string;
}

export interface NarrativeMonitorRuntimeInput {
  latestRun?: RunManifest | null;
  recentRuns?: RunManifest[];
  runMode?: 'research' | 'test' | 'unlabeled';
  providerConfigured?: boolean;
  providerName?: string;
  agentAudit?: IntakeAgentAudit | null;
  agentVerification?: IntakeAgentVerificationReport | null;
  intakeSession?: EvidenceIntakeSession | null;
  topicAudit?: TopicResolutionAudit | null;
  sourceInventory?: WorldMonitorSourceInventory | null;
  sourceSync?: WorldMonitorSyncReport | null;
  applyResult?: EvidenceIntakeApplyResult | null;
  researchAgent?: Partial<NarrativeResearchAgentStatus> | null;
  graphPromotion?: NarrativeGraphPromotionReport | null;
  webResearch?: WebResearchReport | null;
  researchCampaign?: ResearchCampaign | null;
  directSourceResearch?: DirectSourceResearchReport | null;
  researchLeadTriage?: ResearchLeadTriageReport | null;
  researchSourceRetrieval?: ResearchSourceRetrievalReport | null;
  researchBaselineCompletion?: ResearchBaselineCompletionReport | null;
  autonomousPromotion?: AutonomousPromotionReport | null;
  topicDiscoveryProposals?: TopicDiscoveryProposal[];
  evidenceChain?: EvidenceChainEntry[];
  artifactTimes?: Array<{
    artifact_type: NarrativeArtifactStatus['artifact_type'];
    generated_at: string | null;
    run_id: string | null;
  }>;
  now?: string;
}
