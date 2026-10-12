/**
 * Deep research sweep artifacts.
 *
 * A multi-round, budget-bounded autonomous sweep that iteratively deepens web
 * discovery across the current topic/branch campaign. Round 0 is the standard
 * source-aware campaign; each follow-up round derives new search angles from
 * the previous round's leads (deterministically, like an analyst following up
 * on interesting hits) and re-enters the same governed retrieval pipeline.
 * Search results always remain context-only research leads — nothing is
 * imported until it passes the Intake/AI-shadow evidence gate.
 */

/** One round of the sweep: what was searched and how many leads it produced. */
export interface DeepResearchSweepRound {
  round: number;
  queries: number;
  leads: number;
  follow_up_queries: string[];
}

export interface DeepResearchSweep {
  artifact_type: 'deep_research_sweep';
  schema_version: '1.0.0';
  producer_version: string;
  sweep_id: string;
  generated_at: string;
  /** Number of topic/branch tasks the sweep searched over. */
  campaign_task_count: number;
  rounds: DeepResearchSweepRound[];
  totals: { rounds: number; queries: number; leads: number };
  guardrail_check: {
    search_results_remain_context_only: true;
    bounded_rounds: true;
    bounded_queries: true;
    no_auto_import: true;
    no_trading_advice: true;
  };
}

export interface DeepResearchSweepInput {
  /** Follow-up rounds beyond the initial campaign pass (default 20, max 20). */
  max_rounds?: number;
  /** Follow-up query budget per round (default 50, max 50). */
  queries_per_round?: number;
  /** Round-0 planned query cap (default 24). */
  max_queries?: number;
  /** Campaign task cap for the sweep (default 120). */
  max_tasks?: number;
  /** Direct-source query cap for the sweep (default 30). */
  max_direct_queries?: number;
}
