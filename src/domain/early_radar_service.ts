import type { Stage } from './stages';
import { isEarlyRadarStage } from './stages';
import type { ReactivationType } from '../rules/reactivation_rules';
import { shouldEnterRadar } from '../rules/reactivation_rules';
import type { ResearchAction } from './dashboard_card_service';
import { assertResearchAction } from './dashboard_card_service';

export interface EarlyRadarInput {
  current_stage: Stage;
  isS7CBranchMutation?: boolean;
  reactivation_type: ReactivationType;
  narrative_delta_score: number;
}

export interface EarlyRadarCandidateInput extends EarlyRadarInput {
  candidate_id: string;
  candidate_name: string;
  parent_narrative: string;
  branch_name?: string;
  transition_target: string;
  signal_origin: ReactivationType;
  reactivation_record_id?: string;
  data_confidence: number;
  why_early: string;
  why_not_confirmed: string;
  next_triggers: string[];
  failure_signals: string[];
  suggested_action: ResearchAction;
}

export interface EarlyRadarCandidate {
  candidate_id: string;
  candidate_name: string;
  parent_narrative: string;
  branch_name?: string;
  current_stage: Stage;
  transition_target: string;
  radar_pool: string;
  early_opportunity_type: string;
  signal_origin: ReactivationType;
  reactivation_record_id?: string;
  narrative_delta_score: number;
  early_opportunity_score: number;
  data_confidence: number;
  why_early: string;
  why_not_confirmed: string;
  next_triggers: string[];
  failure_signals: string[];
  suggested_action: ResearchAction;
}

export function qualifiesForEarlyRadar(input: EarlyRadarInput): boolean {
  if (!isEarlyRadarStage(input.current_stage) && !input.isS7CBranchMutation) return false;
  return shouldEnterRadar(input.reactivation_type, input.narrative_delta_score);
}

export function radarPoolForStage(stage: Stage, isS7CBranchMutation = false): string {
  if (isS7CBranchMutation) return 'S7C Branch Mutation Pool';
  if (stage === 'S1') return 'S1 Attention Pool';
  if (stage === 'S2') return 'S2 Hypothesis Pool';
  if (stage === 'S3') return 'S3 Label Pool';
  if (stage === 'S4') return 'S4 Early Trading Pool';
  return 'Not Early Radar Eligible';
}

export function calculateEarlyOpportunityScore(input: { narrative_delta_score: number; data_confidence: number }): number {
  return Math.round(input.narrative_delta_score * 0.7 + input.data_confidence * 0.3);
}

export function createEarlyRadarCandidate(input: EarlyRadarCandidateInput): EarlyRadarCandidate {
  assertResearchAction(input.suggested_action);
  if (input.signal_origin !== 'new_topic' && !input.reactivation_record_id) {
    throw new Error('Early Radar requires reactivation_record_id for old topics and branch mutations');
  }
  if (!qualifiesForEarlyRadar(input)) {
    throw new Error('Candidate does not qualify for Early Radar');
  }

  return {
    candidate_id: input.candidate_id,
    candidate_name: input.candidate_name,
    parent_narrative: input.parent_narrative,
    branch_name: input.branch_name,
    current_stage: input.current_stage,
    transition_target: input.transition_target,
    radar_pool: radarPoolForStage(input.current_stage, input.isS7CBranchMutation),
    early_opportunity_type: input.isS7CBranchMutation ? 'S7C Branch Mutation' : 'Stage Gate Candidate',
    signal_origin: input.signal_origin,
    reactivation_record_id: input.reactivation_record_id,
    narrative_delta_score: input.narrative_delta_score,
    early_opportunity_score: calculateEarlyOpportunityScore(input),
    data_confidence: input.data_confidence,
    why_early: input.why_early,
    why_not_confirmed: input.why_not_confirmed,
    next_triggers: input.next_triggers,
    failure_signals: input.failure_signals,
    suggested_action: input.suggested_action,
  };
}
