/**
 * Autonomous research agent loop artifacts.
 *
 * The loop is the daily "research analyst" that reuses existing governed
 * capabilities (source sync, intake agent, AI shadow, learning cycle) inside
 * one repeatable cycle. A versioned policy can publish validated formal
 * evidence and activate graph nodes after independent-source thresholds. It
 * never lets a model set Stage/Score, mutate rules, or emit trading advice.
 */

export type ResearchAgentPhase = 'research' | 'analyze' | 'import' | 'produce' | 'iterate' | 'evolve';
export type ResearchAgentLoopKind = 'daily' | 'quick' | 'manual';
export type ResearchAgentTrigger = 'scheduler' | 'manual' | 'cli' | 'webhook';
export type ResearchAgentRunStatus = 'running' | 'completed' | 'partial' | 'failed';
export type ResearchAgentPhaseStatus = 'ok' | 'skipped' | 'failed';

export interface ResearchAgentPhaseResult {
  phase: ResearchAgentPhase;
  status: ResearchAgentPhaseStatus;
  detail: string;
  started_at: string;
  completed_at: string;
  artifact_paths: string[];
}

export interface ResearchAgentRunManifest {
  artifact_type: 'research_agent_run_manifest';
  schema_version: '1.0.0';
  producer_version: string;
  run_id: string;
  triggered_by: ResearchAgentTrigger;
  loop_kind: ResearchAgentLoopKind;
  started_at: string;
  completed_at: string;
  status: ResearchAgentRunStatus;
  phases: ResearchAgentPhaseResult[];
  metrics: {
    sources_requested: number;
    sources_completed: number;
    sources_failed: number;
    web_research_queries: number;
    web_research_leads: number;
    direct_source_queries: number;
    direct_source_leads: number;
    research_campaign_tasks: number;
    research_campaign_source_targets: number;
    research_campaign_seed_topics: number;
    candidate_count: number;
    imported_evidence_count: number;
    provisional_topics_activated: number;
    watch_branches_activated: number;
    graph_nodes_held: number;
    weekly_run_id: string | null;
    learning_cycle_id: string | null;
    purged_stale_candidates: number;
    purged_aged_queue_items: number;
    evolution_proposals: number;
    drift_detected: boolean;
  };
  guardrail_check: {
    no_auto_import: boolean;
    no_auto_stage_change: boolean;
    no_auto_topic_activation: boolean;
    no_auto_rule_mutation: boolean;
    human_review_required: boolean;
    no_trading_advice: true;
  };
  failure?: {
    phase: ResearchAgentPhase;
    message: string;
  };
}

export interface AgentPurgeDecision {
  discard: boolean;
  reason: string;
  age_days: number;
  category: 'stale_candidate' | 'aged_queue_item';
  target_id: string;
}

export interface EvolutionMetricSnapshot {
  run_id: string;
  recorded_at: string;
  acceptance_rate: number | null;
  shadow_agreement_rate: number | null;
  golden_gate_pass_rate: number | null;
  candidate_count: number;
}

export interface EvolutionDriftFlag {
  metric: string;
  current: number | null;
  baseline: number | null;
  deviation: number | null;
  threshold: number;
  detected: boolean;
}

export interface EvolutionProposal {
  proposal_id: string;
  kind: 'scheduler_adjustment' | 'prompt_adjustment' | 'review_priority_adjustment' | 'source_configuration';
  rationale: string;
  evidence: Array<{ metric: string; value: number | null }>;
  status: 'proposed' | 'approved' | 'rejected';
  requires_human_approval: boolean;
  created_at: string;
}

export interface ResearchAgentEvolutionLedger {
  artifact_type: 'research_agent_evolution_ledger';
  schema_version: '1.0.0';
  producer_version: string;
  ledger_id: string;
  generated_at: string;
  last_run_id: string | null;
  history: EvolutionMetricSnapshot[];
  rolling_acceptance_rate: number | null;
  rolling_shadow_agreement_rate: number | null;
  rolling_golden_gate_pass_rate: number | null;
  drift_flags: EvolutionDriftFlag[];
  proposals: EvolutionProposal[];
  guardrail_check: {
    advisory_only: boolean;
    no_auto_rule_mutation: boolean;
    proposals_require_human_approval: boolean;
    no_auto_import: boolean;
  };
}

export interface ResearchAgentSchedulerConfig {
  artifact_type: 'research_agent_scheduler_config';
  schema_version: '1.0.0';
  enabled: boolean;
  timezone: string;
  daily_cron: string;
  daily_max_operations: number;
  quick_interval_hours: number;
  quick_max_operations: number;
  quick_enabled: boolean;
  purge: {
    stale_candidate_max_age_days: number;
    queue_high_priority_max_age_days: number;
    queue_medium_priority_max_age_days: number;
    queue_low_priority_max_age_days: number;
    evolution_history_max_entries: number;
  };
  guardrail_check: {
    no_auto_import: boolean;
    no_auto_stage_change: boolean;
    no_auto_topic_activation: boolean;
    no_auto_rule_mutation: boolean;
  };
}

export const DEFAULT_SCHEDULER_CONFIG: ResearchAgentSchedulerConfig = {
  artifact_type: 'research_agent_scheduler_config',
  schema_version: '1.0.0',
  enabled: true,
  timezone: 'Asia/Shanghai',
  daily_cron: '0 6 * * *',
  daily_max_operations: 40,
  quick_interval_hours: 6,
  quick_max_operations: 12,
  quick_enabled: true,
  purge: {
    stale_candidate_max_age_days: 30,
    queue_high_priority_max_age_days: 14,
    queue_medium_priority_max_age_days: 21,
    queue_low_priority_max_age_days: 30,
    evolution_history_max_entries: 30,
  },
  guardrail_check: {
    no_auto_import: false,
    no_auto_stage_change: false,
    no_auto_topic_activation: false,
    no_auto_rule_mutation: true,
  },
};
