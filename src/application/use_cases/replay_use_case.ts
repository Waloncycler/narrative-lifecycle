import type { EvidenceNode } from '../../domain/evidence';
import { qualifiesForEarlyRadar } from '../../domain/early_radar_service';
import {
  branchStagesForReplay,
  evidenceAvailableAt,
  futureEvidenceIds,
  noFutureEvidenceUsed,
  noTradingAdvice,
  parentStageForReplay,
  validateReplayCase,
} from '../../domain/replay_rules';
import type { Stage } from '../../domain/stages';
import { isEarlyRadarStage, isStage } from '../../domain/stages';
import { buildStageDiff } from '../../domain/stage_diff_engine';
import { RULE_VERSION } from '../../domain/versioning_service';
import { artifactMetadata } from '../../types/artifact_contract';
import type { StageDiff, StageSnapshotHistory, StageSnapshotRadarCandidate, StageSnapshotTopic } from '../../types/diff';
import type { ReplayCase, ReplayCaseResult, ReplayLedger, ReplaySliceResult } from '../../types/replay';
import type { RunManifest } from '../../types/run_context';

export interface ReplayUseCaseDeps {
  readReplayCases(): ReplayCase[];
  readLatestRun(): RunManifest | null;
  writeReplayLedger(ledger: ReplayLedger, markdown: string): void;
  renderMarkdown(ledger: ReplayLedger): string;
  validateLedger(ledger: ReplayLedger): void;
  sourceArtifacts(): string[];
  now(): string;
}

export class ReplayUseCase {
  constructor(private readonly deps: ReplayUseCaseDeps) {}

  execute(): ReplayLedger {
    const cases = this.deps.readReplayCases();
    const validationErrors = cases.flatMap(validateReplayCase);
    if (validationErrors.length) throw new Error(`replay case validation failed: ${validationErrors.join('; ')}`);

    const latestRun = this.deps.readLatestRun();
    const generatedAt = this.deps.now();
    const runId = latestRun?.run_id ?? `run_${generatedAt.replaceAll('-', '').replaceAll(':', '').replace('.', '').slice(0, 17)}_replay`;
    const replayCases = cases.map((replayCase) => replayCaseResult(replayCase, runId, generatedAt));
    const allDiffs = replayCases.flatMap((result) => result.diffs);
    const publicCases = replayCases.map(({ diffs, ...result }) => result);
    const leadTimes = publicCases
      .map((item) => item.lead_time_days)
      .filter((item): item is number => typeof item === 'number');

    const ledger: ReplayLedger = {
      ...artifactMetadata({
        artifact_type: 'historical_replay_ledger',
        rule_version: latestRun?.rule_version ?? RULE_VERSION,
        run_id: runId,
        generated_at: generatedAt,
      }),
      producer_version: '0.5.1',
      ledger_id: `replay_ledger_${runId}`,
      status: publicCases.length ? 'ok' : 'insufficient_history',
      source_artifacts: this.deps.sourceArtifacts(),
      case_count: publicCases.length,
      replay_cases: publicCases,
      aggregate: {
        success_count: publicCases.filter((item) => item.outcome_status === 'confirmed').length,
        failure_count: publicCases.filter((item) => item.outcome_status === 'falsified').length,
        misclassification_count: publicCases.filter((item) => item.misclassification).length,
        missed_change_count: publicCases.filter((item) => item.missed_change).length,
        false_positive_count: publicCases.filter((item) => item.false_positive).length,
        average_lead_time_days: leadTimes.length
          ? Math.round(leadTimes.reduce((sum, item) => sum + item, 0) / leadTimes.length)
          : 'insufficient_history',
        parent_branch_separation_preserved: publicCases.every((item) => item.parent_branch_separation_preserved),
      },
      guardrail_check: {
        no_future_evidence_used: publicCases.every((item) =>
          item.stage_path.every((slice) => slice.future_evidence_excluded.every((id) => !slice.evidence_ids_used.includes(id))),
        ),
        no_trading_advice: noTradingAdvice(publicCases),
        no_price_based_outcome_inference: !JSON.stringify(cases).toLowerCase().includes('price rise'),
        parent_branch_separation_preserved: publicCases.every((item) => item.parent_branch_separation_preserved),
      },
      debug_diffs: allDiffs,
    };

    if (!ledger.guardrail_check.no_future_evidence_used) throw new Error('replay attempted to use future evidence');
    if (!ledger.guardrail_check.no_trading_advice) throw new Error('replay ledger contains forbidden trading language');
    this.deps.validateLedger(ledger);
    this.deps.writeReplayLedger(ledger, this.deps.renderMarkdown(ledger));
    return ledger;
  }
}

function replayCaseResult(replayCase: ReplayCase, runId: string, generatedAt: string): ReplayCaseResult & { diffs: StageDiff[] } {
  let previous: StageSnapshotHistory | null = null;
  const diffs: StageDiff[] = [];
  const stagePath: ReplaySliceResult[] = replayCase.slices.map((slice, index) => {
    const available = evidenceAvailableAt(replayCase.evidence, slice.as_of);
    if (!noFutureEvidenceUsed(available, slice.as_of)) throw new Error(`${replayCase.case_id}/${slice.slice_id}: future evidence leak`);
    const parent = parentStageForReplay({
      evidence: available,
      requestedStage: replayCase.requested_stage,
      dataConfidence: replayCase.data_confidence,
    });
    const branches = branchStagesForReplay(available, replayCase.data_confidence);
    const radar = earlyRadarCandidates(replayCase, parent.current_stage, branches, available);
    const snapshot = snapshotForCase({
      replayCase,
      runId,
      generatedAt,
      sliceIndex: index,
      sliceId: slice.slice_id,
      parent,
      branches,
      radar,
    });
    const diff = buildStageDiff(snapshot, previous);
    previous = snapshot;
    diffs.push(diff);
    return {
      slice_id: slice.slice_id,
      as_of: slice.as_of,
      evidence_ids_used: available.map((item) => item.evidence_id).sort(),
      future_evidence_excluded: futureEvidenceIds(replayCase.evidence, slice.as_of),
      parent_stage: parent.current_stage,
      branch_stages: branches,
      why_not_higher_stage: parent.why_not_higher_stage,
      early_radar_candidate_ids: radar.map((item) => item.candidate_id),
      diff_change_type: diff.topic_changes[0]?.change_type ?? 'no_change',
      diff_detected_changes: diff.topic_changes[0]?.detected_changes ?? [],
    };
  });

  const finalStage = stagePath.at(-1)?.parent_stage ?? 'S0';
  const parentBranchSeparation = replayCase.scenario_type !== 's7c'
    || stagePath.every((slice) =>
      slice.branch_stages.every((branch) => branch.current_stage !== 'S7C' || slice.parent_stage !== 'S7C'),
    );
  const lead = leadTimeDays(stagePath, replayCase);
  const missedChange = replayCase.outcome.status === 'confirmed' && lead === 'missed';
  const falsePositive = replayCase.outcome.status === 'falsified' && finalStage !== 'S0' && finalStage !== 'S1' && finalStage !== 'S2';

  return {
    case_id: replayCase.case_id,
    topic_id: replayCase.topic_id,
    scenario_type: replayCase.scenario_type,
    stage_path: stagePath,
    final_stage_before_outcome: finalStage,
    outcome_status: replayCase.outcome.status,
    correct_stage: replayCase.outcome.correct_stage,
    outcome_summary: replayCase.outcome.summary,
    misclassification: finalStage !== replayCase.outcome.correct_stage,
    lead_time_days: lead,
    missed_change: missedChange,
    false_positive: falsePositive,
    parent_branch_separation_preserved: parentBranchSeparation,
    calibration_suggestion: replayCase.calibration_note,
    diffs,
  };
}

function earlyRadarCandidates(
  replayCase: ReplayCase,
  parentStage: string,
  branches: Array<{ branch_id: string; current_stage: string; evidence_ids: string[] }>,
  evidence: EvidenceNode[],
): StageSnapshotRadarCandidate[] {
  const result: StageSnapshotRadarCandidate[] = [];
  if (isStage(parentStage) && isEarlyRadarStage(parentStage) && qualifiesForEarlyRadar({
    current_stage: parentStage,
    reactivation_type: 'new_topic',
    narrative_delta_score: Math.min(90, 35 + evidence.length * 12),
  })) {
    result.push({
      candidate_id: `radar_${replayCase.case_id}_${parentStage}`,
      candidate_topic: replayCase.topic_name,
      reactivation_record_id: `replay_reactivation_${replayCase.case_id}`,
      evidence_ids: evidence.map((item) => item.evidence_id).sort(),
    });
  }

  for (const branch of branches.filter((item) => item.current_stage === 'S7C')) {
    const parentForRadar: Stage = isStage(parentStage) ? parentStage : 'S4';
    if (qualifiesForEarlyRadar({
      current_stage: parentForRadar,
      isS7CBranchMutation: true,
      reactivation_type: 'branch_mutation',
      narrative_delta_score: 75,
    })) {
      result.push({
        candidate_id: `radar_${replayCase.case_id}_${branch.branch_id}`,
        candidate_topic: replayCase.topic_name,
        reactivation_record_id: `replay_branch_mutation_${replayCase.case_id}_${branch.branch_id}`,
        evidence_ids: branch.evidence_ids,
      });
    }
  }
  return result;
}

function snapshotForCase(input: {
  replayCase: ReplayCase;
  runId: string;
  generatedAt: string;
  sliceIndex: number;
  sliceId: string;
  parent: { current_stage: string; max_allowed_stage: string; why_not_higher_stage: string; evidence_ids: string[] };
  branches: Array<{ branch_id: string; current_stage: string; evidence_ids: string[] }>;
  radar: StageSnapshotRadarCandidate[];
}): StageSnapshotHistory {
  const topic: StageSnapshotTopic = {
    topic_id: input.replayCase.topic_id,
    topic_name: input.replayCase.topic_name,
    parent_narrative: input.replayCase.parent_narrative,
    current_stage: input.parent.current_stage,
    gate_stage: input.parent.current_stage,
    max_allowed_stage: input.parent.max_allowed_stage,
    strongest_branch: input.branches[0]?.branch_id ?? 'none',
    weakest_layer: input.parent.why_not_higher_stage,
    data_confidence: input.replayCase.data_confidence >= 75 ? 'high' : input.replayCase.data_confidence >= 50 ? 'medium' : 'low',
    evidence_ids: input.parent.evidence_ids,
    score_id: `replay_score_${input.replayCase.case_id}_${input.sliceId}`,
    dashboard_card_id: `replay_card_${input.replayCase.case_id}_${input.sliceId}`,
    why_not_higher_stage: input.parent.why_not_higher_stage,
    gate_why_not_higher_stage: input.parent.why_not_higher_stage,
    gate_evidence_ids: input.parent.evidence_ids,
    branches: input.branches.map((branch) => ({
      branch_id: branch.branch_id,
      branch_name: branch.branch_id,
      current_stage: branch.current_stage,
      evidence_ids: branch.evidence_ids,
      reactivation_record_id: branch.current_stage === 'S7C' ? `replay_branch_mutation_${input.replayCase.case_id}_${branch.branch_id}` : null,
    })),
  };
  return {
    ...artifactMetadata({
      artifact_type: 'stage_snapshot_history',
      rule_version: RULE_VERSION,
      run_id: input.runId,
      generated_at: input.generatedAt,
    }),
    snapshot_id: `replay_snapshot_${input.replayCase.case_id}_${input.sliceIndex}`,
    source_report_id: `replay_case_${input.replayCase.case_id}`,
    topics: [topic],
    early_radar_candidates: input.radar,
    guardrail_check: {
      no_trading_advice: true,
      research_only_actions: true,
      parent_branch_separation_preserved: true,
      evidence_ids_visible: true,
      why_not_higher_present: true,
      data_confidence_present: true,
    },
  };
}

function leadTimeDays(stagePath: ReplaySliceResult[], replayCase: ReplayCase): number | 'missed' | 'not_applicable' {
  if (replayCase.outcome.status === 'no_change') return 'not_applicable';
  const firstSignal = stagePath.find((slice) =>
    slice.parent_stage === replayCase.outcome.correct_stage ||
    slice.early_radar_candidate_ids.length > 0 ||
    slice.branch_stages.some((branch) => branch.current_stage === replayCase.outcome.correct_stage),
  );
  if (!firstSignal) return 'missed';
  return Math.max(0, Math.round((Date.parse(replayCase.outcome.revealed_at) - Date.parse(firstSignal.as_of)) / 86_400_000));
}
