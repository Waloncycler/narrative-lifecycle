import type { ScoreDetails } from './scoring';
import { maxStageInExpression, stageRank, type StageSnapshot } from './stages';
import { maximumStageByDataConfidence } from '../rules/data_confidence_rules';
import { RULE_VERSION } from './versioning_service';

export type ResearchAction =
  | 'observe'
  | 'early research'
  | 'focus tracking'
  | 'wait for confirmation'
  | 'validation tracking'
  | 'overcrowding alert'
  | 'failure watch';

export interface DashboardCard {
  card_id: string;
  topic_id: string;
  topic_name: string;
  as_of_date: string;
  current_stage: string;
  transition_target: string;
  stage_confidence: number;
  stage_reasoning: string;
  why_not_lower_stage: string;
  why_not_higher_stage: string;
  stage_snapshot: StageSnapshot;
  parent_narrative: string;
  key_branches: DashboardBranch[];
  key_events: DashboardEvent[];
  evidence_ids: string[];
  score_id: string;
  scores: ScoreDetails;
  data_confidence: number;
  narrative_memory_status?: string;
  next_triggers: string[];
  failure_signals: string[];
  action: ResearchAction;
  review_window: string;
  rule_version: string;
}

export interface DashboardBranch {
  branch_id: string;
  branch_name: string;
  current_stage: string;
  evidence_ids: string[];
  branch_coverage_score: number;
  parent_lift_assessment: string;
}

export interface DashboardEvent {
  evidence_id: string;
  event_title: string;
  reason_used: string;
}

const allowedActions: ResearchAction[] = [
  'observe',
  'early research',
  'focus tracking',
  'wait for confirmation',
  'validation tracking',
  'overcrowding alert',
  'failure watch',
];

export function assertResearchAction(action: ResearchAction): void {
  if (!allowedActions.includes(action)) {
    throw new Error('Dashboard action must be a research action, not investment advice');
  }
}

export function createDashboardCard(input: Omit<DashboardCard, 'rule_version'>): DashboardCard {
  assertResearchAction(input.action);
  if (!input.why_not_higher_stage) {
    throw new Error('Dashboard Card requires why_not_higher_stage');
  }
  if (input.evidence_ids.length === 0 || input.key_events.length === 0) {
    throw new Error('Dashboard Card requires evidence traceability');
  }
  const confidenceMaximum = maximumStageByDataConfidence(input.data_confidence);
  if (stageRank[maxStageInExpression(input.current_stage)] > stageRank[confidenceMaximum]) {
    throw new Error('Dashboard Card current_stage exceeds Data Confidence cap');
  }

  return {
    ...input,
    rule_version: RULE_VERSION,
  };
}
