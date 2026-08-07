import type { StageDiff } from '../../types/diff';
import type { OperatorReview } from '../../types/operator_review';
import type { PilotLedgerEntry, PilotObservation, PilotResearchLedger, PilotTopic } from '../../types/pilot';
import type { WeeklyBrief } from '../../types/report';
import type { RunManifest } from '../../types/run_context';
import { artifactMetadata } from '../../types/artifact_contract';
import { RULE_VERSION } from '../../domain/versioning_service';
import {
  agreementRate,
  assertPilotAction,
  mergePilotObservation,
  metricOrInsufficient,
  noTradingAdvice,
  pilotActionFor,
  validatePilotTopic,
} from '../../domain/pilot_rules';

export interface PilotInitUseCaseDeps {
  readWeeklyBrief(): WeeklyBrief;
  writePilotSeed(topics: PilotTopic[], observations: PilotObservation[]): void;
  pilotFilesExist(): boolean;
}

export class PilotInitUseCase {
  constructor(private readonly deps: PilotInitUseCaseDeps) {}

  execute(): { topic_count: number; status: 'created' | 'exists' } {
    if (this.deps.pilotFilesExist()) return { topic_count: 0, status: 'exists' };
    const weekly = this.deps.readWeeklyBrief();
    const topics = seedPilotTopics(weekly);
    this.deps.writePilotSeed(topics, seedPilotObservations(topics, weekly.run_id));
    return { topic_count: topics.length, status: 'created' };
  }
}

export interface PilotReviewUseCaseDeps {
  readLatestRun(): RunManifest;
  readWeeklyBrief(): WeeklyBrief;
  readStageDiff(): StageDiff;
  readOperatorReview(): OperatorReview;
  readPilotTopics(): PilotTopic[];
  readPilotObservations(): PilotObservation[];
  writePilotLedger(ledger: PilotResearchLedger, markdown: string): void;
  writePilotEvaluationSummary(summary: PilotResearchLedger['evaluation_summary']): void;
  renderMarkdown(ledger: PilotResearchLedger): string;
  validateLedger(ledger: PilotResearchLedger): void;
  validateEvaluationSummary(summary: PilotResearchLedger['evaluation_summary']): void;
  sourceArtifacts(): string[];
}

export class PilotReviewUseCase {
  constructor(private readonly deps: PilotReviewUseCaseDeps) {}

  execute(): PilotResearchLedger {
    const latestRun = this.deps.readLatestRun();
    const weekly = this.deps.readWeeklyBrief();
    const diff = this.deps.readStageDiff();
    const operatorReview = this.deps.readOperatorReview();
    const observations = latestObservationByTopic(this.deps.readPilotObservations(), latestRun.run_id);
    const topics = this.deps.readPilotTopics();
    const validationErrors = topics.flatMap(validatePilotTopic);
    if (validationErrors.length) throw new Error(`pilot topic validation failed: ${validationErrors.join('; ')}`);

    const weeklyByTopic = new Map(weekly.stage_snapshot.map((item) => [item.topic_id, item]));
    const whyByTopic = new Map(weekly.why_not_higher.map((item) => [item.topic_id, item]));
    const changeByTopic = new Map(diff.topic_changes.map((item) => [item.topic_id, item]));

    const entries: PilotLedgerEntry[] = topics.map((topic) => {
      const merged = mergePilotObservation(topic, observations.get(topic.topic_id));
      const weeklyTopic = weeklyByTopic.get(topic.topic_id);
      const why = whyByTopic.get(topic.topic_id);
      const change = changeByTopic.get(topic.topic_id);
      const observation = observations.get(topic.topic_id);
      const branchMutation = Boolean(change?.detected_changes.includes('branch_mutation_candidate'));
      const action = pilotActionFor({
        posterior_direction: merged.posterior_direction,
        event_intensity: merged.event_intensity,
        operator_agreement: merged.operator_agreement,
        outcome_status: merged.outcome_status,
        branch_mutation_detected: branchMutation,
        diff_detected_changes: change?.detected_changes ?? [],
      });
      assertPilotAction(action);
      return {
        ...merged,
        current_stage: merged.current_stage,
        strongest_evidence_ids: merged.strongest_evidence_ids.length ? merged.strongest_evidence_ids : why?.evidence_ids ?? [],
        why_not_higher_stage: merged.why_not_higher_stage || why?.why_not_higher_stage || 'No higher-stage justification recorded yet.',
        latest_artifact_stage: weeklyTopic?.current_stage ?? null,
        diff_change_type: change?.change_type ?? null,
        diff_detected_changes: change?.detected_changes ?? [],
        branch_mutation_detected: branchMutation,
        missed_change_detected: observation?.missed_change ?? false,
        artifact_evidence_ids: why?.evidence_ids ?? [],
        research_only_action: action,
        status_note: statusNote(merged, change?.detected_changes ?? []),
      };
    });

    const ledger: PilotResearchLedger = {
      ...artifactMetadata({
        artifact_type: 'pilot_research_ledger',
        rule_version: latestRun.rule_version ?? RULE_VERSION,
        run_id: latestRun.run_id,
        generated_at: latestRun.completed_at,
      }),
      producer_version: '0.5.0',
      ledger_id: `research_ledger_${latestRun.run_id}`,
      status: entries.length >= 2 && operatorReview.status === 'ok' ? 'ok' : 'insufficient_history',
      source_artifacts: this.deps.sourceArtifacts(),
      pilot_topic_count: entries.length,
      ledger_entries: entries,
      evaluation_summary: evaluationSummary(entries, operatorReview),
      guardrail_check: {
        no_trading_advice: noTradingAdvice(entries),
        required_hypotheses_present: entries.every((entry) => entry.current_hypothesis.length > 0 && entry.competing_hypothesis.length > 0),
        required_falsification_triggers_present: entries.every((entry) => entry.falsification_trigger.length > 0),
        research_only_actions: entries.every((entry) => ['observe', 'wait', 'validate', 'review', 'monitor', 'flag_risk'].includes(entry.research_only_action)),
        branch_parent_separation_preserved: entries.every((entry) =>
          !entry.branch_mutation_detected || entry.diff_detected_changes.includes('branch_mutation_candidate') || entry.diff_detected_changes.length === 0,
        ),
      },
    };
    if (!ledger.guardrail_check.no_trading_advice) throw new Error('pilot ledger contains forbidden trading language');
    this.deps.validateLedger(ledger);
    this.deps.validateEvaluationSummary(ledger.evaluation_summary);
    this.deps.writePilotLedger(ledger, this.deps.renderMarkdown(ledger));
    this.deps.writePilotEvaluationSummary(ledger.evaluation_summary);
    return ledger;
  }
}

function latestObservationByTopic(observations: PilotObservation[], runId: string): Map<string, PilotObservation> {
  const result = new Map<string, PilotObservation>();
  for (const observation of observations) {
    if (!observation.run_id || observation.run_id === runId) result.set(observation.topic_id, observation);
  }
  return result;
}

function statusNote(topic: PilotTopic, detectedChanges: string[]): string {
  if (topic.outcome_status === 'falsified') return 'Falsification trigger reached or operator marked the hypothesis falsified.';
  if (topic.outcome_status === 'confirmed') return 'Outcome marked confirmed by operator observation.';
  if (detectedChanges.includes('no_change')) return 'No change is a valid pilot state; continue the validation window.';
  if (topic.posterior_direction !== 'unchanged') return `Posterior direction recorded as ${topic.posterior_direction} from artifacts or operator observation.`;
  return 'Pilot topic remains under observation.';
}

function evaluationSummary(entries: PilotLedgerEntry[], operatorReview: OperatorReview): PilotResearchLedger['evaluation_summary'] {
  const changed = entries.filter((entry) => entry.diff_detected_changes.some((change) => change !== 'no_change'));
  const resolvedChanged = changed.filter((entry) => entry.outcome_status !== 'pending');
  const confirmedChanged = resolvedChanged.filter((entry) => entry.outcome_status === 'confirmed');
  const earlyRadarEntries = entries.filter((entry) => entry.tail_structure === 'right_tail_candidate');
  const resolvedEarlyRadarEntries = earlyRadarEntries.filter((entry) => entry.outcome_status !== 'pending');
  const earlyRadarConfirmed = resolvedEarlyRadarEntries.filter((entry) => entry.outcome_status === 'confirmed');
  const noChange = operatorReview.consecutive_no_change_topics.map((item) => item.consecutive_run_count);
  return {
    research_time_saved: 'insufficient_history',
    operator_agreement_rate: agreementRate(entries),
    stage_change_precision: resolvedChanged.length ? Math.round((confirmedChanged.length / resolvedChanged.length) * 100) / 100 : 'insufficient_history',
    early_radar_follow_through: resolvedEarlyRadarEntries.length ? Math.round((earlyRadarConfirmed.length / resolvedEarlyRadarEntries.length) * 100) / 100 : 'insufficient_history',
    false_positive_count: entries.filter((entry) => entry.outcome_status === 'falsified' && entry.posterior_direction === 'up').length,
      missed_change_count: entries.filter((entry) => entry.missed_change_detected || entry.operator_comment.toLowerCase().includes('missed change')).length,
    falsification_count: entries.filter((entry) => entry.outcome_status === 'falsified').length,
    consecutive_no_change_runs: metricOrInsufficient(noChange.length ? Math.max(...noChange) : null),
  };
}

function seedPilotTopics(weekly: WeeklyBrief): PilotTopic[] {
  const fromWeekly = weekly.stage_snapshot.map((topic) => {
    const why = weekly.why_not_higher.find((item) => item.topic_id === topic.topic_id);
    return {
      topic_id: topic.topic_id,
      current_hypothesis: `${topic.topic_name} remains in ${topic.current_stage} until new evidence changes the persisted artifacts.`,
      competing_hypothesis: `${topic.topic_name} may be a narrower branch event rather than a parent narrative transition.`,
      current_stage: topic.current_stage,
      prior_band: topic.data_confidence >= 75 ? 'high' : topic.data_confidence >= 50 ? 'medium' : 'low',
      posterior_direction: 'unchanged',
      event_intensity: 'medium',
      tail_structure: topic.current_stage.includes('S7') ? 'right_tail_candidate' : 'normal',
      strongest_evidence_ids: why?.evidence_ids ?? [],
      why_not_higher_stage: why?.why_not_higher_stage ?? 'Higher-stage evidence is not yet sufficient.',
      falsification_trigger: 'New persisted evidence contradicts the current stage or removes a required Stage Gate layer.',
      next_validation_window: '4-6 weeks',
      operator_agreement: 'uncertain',
      operator_comment: 'Initial pilot seed; awaiting operator review.',
      outcome_status: 'pending',
    } satisfies PilotTopic;
  });

  const additional: PilotTopic[] = [
    pilotSeed('ai_edge_applications', 'AI edge applications', 'S3', 'right_tail_candidate'),
    pilotSeed('synthetic_biology_tools', 'Synthetic biology tools', 'S2', 'right_tail_candidate'),
    pilotSeed('solid_state_battery', 'Solid-state battery', 'S4', 'normal'),
    pilotSeed('low_altitude_economy', 'Low-altitude economy', 'S4', 'left_tail_risk'),
    pilotSeed('robotics_components', 'Robotics components', 'S5', 'right_tail_candidate'),
    pilotSeed('advanced_packaging', 'Advanced packaging', 'S5', 'normal'),
    pilotSeed('fusion_energy_supply_chain', 'Fusion energy supply chain', 'S2', 'right_tail_candidate'),
  ];
  return [...fromWeekly, ...additional].slice(0, 15);
}

function pilotSeed(topic_id: string, name: string, stage: string, tail: PilotTopic['tail_structure']): PilotTopic {
  return {
    topic_id,
    current_hypothesis: `${name} has observable research signals but still needs artifact-backed validation.`,
    competing_hypothesis: `${name} may remain a local event cluster rather than a durable parent narrative.`,
    current_stage: stage,
    prior_band: 'medium',
    posterior_direction: 'unchanged',
    event_intensity: 'low',
    tail_structure: tail,
    strongest_evidence_ids: [],
    why_not_higher_stage: 'Pilot seed requires future Evidence Table support before any higher-stage claim.',
    falsification_trigger: 'No validated evidence appears during the pilot window or key assumptions are contradicted.',
    next_validation_window: '4-6 weeks',
    operator_agreement: 'uncertain',
    operator_comment: 'Pilot seed; not yet linked to canonical artifacts.',
    outcome_status: 'pending',
  };
}

function seedPilotObservations(topics: PilotTopic[], runId: string): PilotObservation[] {
  return topics.map((topic) => ({
    topic_id: topic.topic_id,
    run_id: runId,
    operator_agreement: topic.operator_agreement,
    operator_comment: topic.operator_comment,
    outcome_status: topic.outcome_status,
  }));
}
