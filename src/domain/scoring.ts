export type ScoreDimension =
  | 'policy_perception'
  | 'market_perception'
  | 'trading_perception'
  | 'capital_confirmation'
  | 'pricing_adoption'
  | 'parent_reality'
  | 'branch_reality'
  | 'branch_coverage'
  | 'feedback'
  | 'execution_friction'
  | 'valuation_friction'
  | 'data_confidence'
  | 'transition_probability'
  | 'narrative_delta_score';

export interface ScoreDetail {
  score: number;
  evidence_ids: string[];
  reasoning: string;
  missing_data: string[];
  confidence: number;
}

export type ScoreDetails = Partial<Record<ScoreDimension, ScoreDetail>>;

export interface ScoreResult {
  score_id: string;
  topic_id: string;
  score_date: string;
  stage_snapshot: StageSnapshot;
  dimensions: ScoreDetails;
  rule_version: string;
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
import type { StageSnapshot } from './stages';
