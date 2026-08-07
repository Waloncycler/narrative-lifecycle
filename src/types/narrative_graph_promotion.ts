import type { AutonomousResearchPolicy } from './autonomous_research';

export type NarrativeGraphNodeKind = 'topic' | 'branch';
export type NarrativeGraphPromotionDecision = 'activated' | 'held';

/**
 * An explainable registry-state transition. It is deliberately separate from
 * Stage and Score: a node may become active while its Stage Gate remains S0.
 */
export interface NarrativeGraphPromotionItem {
  node_kind: NarrativeGraphNodeKind;
  node_id: string;
  parent_topic_id: string;
  previous_status: 'provisional' | 'watch';
  next_status: 'active' | null;
  decision: NarrativeGraphPromotionDecision;
  supporting_evidence_ids: string[];
  independent_source_count: number;
  reasons: string[];
  guardrail_check: {
    evidence_table_only: true;
    parent_evidence_required: boolean;
    branch_does_not_upgrade_parent: true;
    conflict_checked: true;
    no_trading_advice: true;
  };
}

export interface NarrativeGraphPromotionReport {
  artifact_type: 'narrative_graph_promotion_report';
  schema_version: '1.0.0';
  producer_version: string;
  report_id: string;
  run_id: string;
  generated_at: string;
  policy_id: AutonomousResearchPolicy['policy_id'];
  items: NarrativeGraphPromotionItem[];
  summary: {
    provisional_topics_activated: number;
    watch_branches_activated: number;
    held_count: number;
  };
  guardrail_check: {
    evidence_table_required: true;
    stage_first_score_second: true;
    parent_branch_separation: true;
    no_model_stage_or_score_control: true;
    no_trading_advice: true;
  };
}
