import type {
  OperatorAgreement,
  OutcomeStatus,
  PilotAction,
  PilotLedgerEntry,
  PilotMetricValue,
  PilotObservation,
  PilotTopic,
} from '../types/pilot';

const forbiddenAdvicePattern = /\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i;
const allowedActions = new Set<PilotAction>(['observe', 'wait', 'validate', 'review', 'monitor', 'flag_risk']);

export function validatePilotTopic(topic: PilotTopic): string[] {
  const errors: string[] = [];
  if (!topic.topic_id) errors.push('topic_id is required');
  if (!topic.current_hypothesis) errors.push(`${topic.topic_id}: current_hypothesis is required`);
  if (!topic.competing_hypothesis) errors.push(`${topic.topic_id}: competing_hypothesis is required`);
  if (!topic.falsification_trigger) errors.push(`${topic.topic_id}: falsification_trigger is required`);
  if (!topic.why_not_higher_stage) errors.push(`${topic.topic_id}: why_not_higher_stage is required`);
  if (forbiddenAdvicePattern.test(JSON.stringify(topic))) errors.push(`${topic.topic_id}: trading advice terms are not allowed`);
  return errors;
}

export function mergePilotObservation(topic: PilotTopic, observation?: PilotObservation): PilotTopic {
  if (!observation) return topic;
  return {
    ...topic,
    posterior_direction: observation.posterior_direction ?? topic.posterior_direction,
    event_intensity: observation.event_intensity ?? topic.event_intensity,
    tail_structure: observation.tail_structure ?? topic.tail_structure,
    operator_agreement: observation.operator_agreement ?? topic.operator_agreement,
    operator_comment: observation.operator_comment ?? topic.operator_comment,
    outcome_status: observation.outcome_status ?? topic.outcome_status,
  };
}

export function pilotActionFor(input: {
  posterior_direction: string;
  event_intensity: string;
  operator_agreement: OperatorAgreement;
  outcome_status: OutcomeStatus;
  branch_mutation_detected: boolean;
  diff_detected_changes: string[];
}): PilotAction {
  if (input.outcome_status === 'falsified') return 'flag_risk';
  if (input.operator_agreement === 'disagree') return 'review';
  if (input.event_intensity === 'burst') return 'review';
  if (input.posterior_direction === 'up' || input.posterior_direction === 'down') return 'validate';
  if (input.branch_mutation_detected) return 'review';
  if (input.diff_detected_changes.includes('no_change')) return 'wait';
  return 'observe';
}

export function assertPilotAction(action: PilotAction): void {
  if (!allowedActions.has(action)) throw new Error(`Unsafe pilot action: ${action}`);
}

export function noTradingAdvice(value: unknown): boolean {
  return !forbiddenAdvicePattern.test(JSON.stringify(value));
}

export function metricOrInsufficient(value: number | null): PilotMetricValue {
  return value === null || Number.isNaN(value) ? 'insufficient_history' : value;
}

export function agreementRate(entries: PilotLedgerEntry[]): PilotMetricValue {
  const decided = entries.filter((entry) => entry.operator_agreement === 'agree' || entry.operator_agreement === 'disagree');
  if (!decided.length) return 'insufficient_history';
  return Math.round((decided.filter((entry) => entry.operator_agreement === 'agree').length / decided.length) * 100) / 100;
}
