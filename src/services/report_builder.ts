import type { EvidenceLayer } from '../domain/evidence';
import type { ScoreDetail, ScoreDimension } from '../domain/scoring';
import type {
  ResearchSafeActionVerb,
  WeeklyBrief,
  WeeklyBriefEarlyRadarCandidate,
  WeeklyBriefEvidenceItem,
  WeeklyBriefGuardrailCheck,
  WeeklyBriefNextOperatorAction,
  WeeklyBriefStageChange,
  WeeklyBriefStageSnapshot,
  WeeklyBriefWhyNotHigher,
} from '../types/report';
import type { ReportArtifacts } from './report_artifact_loader';
import type { StageDiff } from '../types/diff';
import type { RunContext } from '../types/run_context';
import { artifactMetadata } from '../types/artifact_contract';

const forbiddenAdvicePattern = /\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i;
const researchSafeActions = new Set<ResearchSafeActionVerb>([
  'observe',
  'track',
  'validate',
  'review',
  'monitor',
  'compare',
  'flag_risk',
  'request_more_evidence',
]);
const allowedDashboardActions = new Set([
  'observe',
  'early research',
  'focus tracking',
  'wait for confirmation',
  'validation tracking',
  'overcrowding alert',
  'failure watch',
]);

function scoreEntries(dimensions: Record<string, ScoreDetail | undefined>) {
  return Object.entries(dimensions) as Array<[ScoreDimension, ScoreDetail]>;
}

function weakestLayer(dimensions: Record<string, ScoreDetail | undefined>): string {
  const candidates = scoreEntries(dimensions).filter(([dimension]) => dimension !== 'data_confidence');
  const weakest = candidates.reduce<[string, ScoreDetail] | undefined>((current, next) => {
    if (!current || next[1].score < current[1].score) return next;
    return current;
  }, undefined);
  return weakest?.[0] ?? 'unknown';
}

function strongestBranch(card: ReportArtifacts['dashboard_cards'][number]): string {
  const branch = card.key_branches.reduce<typeof card.key_branches[number] | undefined>((current, next) => {
    if (!current || next.branch_coverage_score > current.branch_coverage_score) return next;
    return current;
  }, undefined);
  return branch ? `${branch.branch_name} (${branch.current_stage})` : 'no independent branch';
}

function stageSnapshots(artifacts: ReportArtifacts): WeeklyBriefStageSnapshot[] {
  return artifacts.dashboard_cards.map((card) => {
    const score = artifacts.scores.find((item) => item.topic_id === card.topic_id);
    return {
      topic_id: card.topic_id,
      topic_name: card.topic_name,
      current_stage: card.current_stage,
      parent_narrative: card.parent_narrative,
      strongest_branch: strongestBranch(card),
      weakest_layer: score ? weakestLayer(score.dimensions) : 'unknown',
      data_confidence: card.data_confidence,
    };
  });
}

function stageChanges(diff: StageDiff): WeeklyBriefStageChange[] {
  return diff.topic_changes.map((change) => ({
    topic_id: change.topic_id,
    topic_name: change.topic_name,
    previous_stage: change.previous_stage,
    current_stage: change.current_stage,
    change_type: change.change_type,
    detected_changes: change.detected_changes,
    new_evidence_ids: change.new_evidence_ids,
    removed_evidence_ids: change.removed_evidence_ids,
    change_reason: change.change_reason,
    priority: change.priority,
    research_only_action: change.research_only_action,
    branch_id: change.branch_id,
    reactivation_record_id: change.reactivation_record_id,
  }));
}

function strongestEvidence(artifacts: ReportArtifacts): WeeklyBriefEvidenceItem[] {
  const layerForDimension = (dimension: ScoreDimension): EvidenceLayer => {
    if (dimension.includes('capital')) return 'capital';
    if (dimension.includes('pricing') || dimension.includes('valuation')) return 'pricing';
    if (dimension.includes('reality') || dimension.includes('branch_coverage')) return 'reality';
    if (dimension.includes('feedback') || dimension.includes('transition') || dimension.includes('narrative_delta')) return 'feedback';
    if (dimension.includes('friction')) return 'friction';
    return 'perception';
  };

  return artifacts.dashboard_cards.flatMap((card) => {
    const eventById = new Map(card.key_events.map((event) => [event.evidence_id, event]));
    const strengthByScore = scoreEntries(card.scores)
      .flatMap(([dimension, detail]) =>
        detail.evidence_ids.map((evidenceId) => ({
          evidence_id: evidenceId,
          dimension,
          score: detail.score,
          reasoning: detail.reasoning,
        })),
      )
      .sort((a, b) => b.score - a.score);
    const seen = new Set<string>();

    return strengthByScore
      .filter((item) => {
        if (!eventById.has(item.evidence_id) || seen.has(item.evidence_id)) return false;
        seen.add(item.evidence_id);
        return true;
      })
      .slice(0, 2)
      .map((item) => ({
        evidence_id: item.evidence_id,
        evidence_strength: `score_${item.score}`,
        affected_layer: [layerForDimension(item.dimension)],
        topic: card.topic_name,
        interpretation: eventById.get(item.evidence_id)?.reason_used ?? item.reasoning,
      }));
  });
}

function whyNotHigher(artifacts: ReportArtifacts): WeeklyBriefWhyNotHigher[] {
  return artifacts.dashboard_cards.map((card) => {
    if (!card.why_not_higher_stage) {
      throw new Error(`Dashboard card missing why_not_higher_stage: ${card.topic_id}`);
    }
    return {
      topic_id: card.topic_id,
      topic_name: card.topic_name,
      current_stage: card.current_stage,
      why_not_higher_stage: card.why_not_higher_stage,
      evidence_ids: card.evidence_ids,
    };
  });
}

function earlyRadarCandidates(artifacts: ReportArtifacts): WeeklyBriefEarlyRadarCandidate[] {
  return artifacts.early_radar_candidates.map((candidate) => {
    if (!candidate.reactivation_record_id) {
      throw new Error(`Early Radar candidate missing reactivation_record_id: ${candidate.candidate_id}`);
    }
    const card = artifacts.dashboard_cards.find((item) => item.topic_name === candidate.candidate_name);
    return {
      candidate_id: candidate.candidate_id,
      candidate_topic: candidate.candidate_name,
      reason: candidate.why_early,
      reactivation_record_id: candidate.reactivation_record_id,
      evidence_ids: card?.evidence_ids ?? [],
      research_only_action: candidate.suggested_action,
    };
  });
}

function guardrailCheck(artifacts: ReportArtifacts): WeeklyBriefGuardrailCheck {
  const generatedOutput = JSON.stringify({
    cards: artifacts.dashboard_cards,
    earlyRadar: artifacts.early_radar_candidates,
  });
  return {
    no_trading_advice: !forbiddenAdvicePattern.test(generatedOutput),
    research_only_actions: artifacts.dashboard_cards.every((card) => allowedDashboardActions.has(card.action)),
    parent_branch_separation_preserved: artifacts.dashboard_cards.every((card) =>
      card.key_branches.every((branch) => branch.parent_lift_assessment.includes('cannot automatically upgrade')),
    ),
    evidence_ids_visible: artifacts.dashboard_cards.every((card) => card.evidence_ids.length > 0),
    why_not_higher_present: artifacts.dashboard_cards.every((card) => card.why_not_higher_stage.length > 0),
    data_confidence_present: artifacts.dashboard_cards.every((card) => typeof card.data_confidence === 'number'),
  };
}

function nextOperatorActions(artifacts: ReportArtifacts): WeeklyBriefNextOperatorAction[] {
  const actions: WeeklyBriefNextOperatorAction[] = artifacts.dashboard_cards.map((card) => ({
    action: card.current_stage === 'S4' ? 'request_more_evidence' : 'monitor',
    topic_id: card.topic_id,
    reason: card.stage_snapshot.why_not_higher_stage,
    evidence_ids: card.stage_snapshot.evidence_ids,
  }));

  for (const candidate of artifacts.early_radar_candidates) {
    const card = artifacts.dashboard_cards.find((item) => item.topic_name === candidate.candidate_name);
    actions.push({
      action: 'track',
      topic_id: card?.topic_id,
      reason: candidate.why_early,
      evidence_ids: card?.evidence_ids ?? [],
    });
  }

  for (const action of actions) {
    if (!researchSafeActions.has(action.action)) {
      throw new Error(`Unsafe report action: ${action.action}`);
    }
  }
  return actions;
}

export function buildWeeklyBrief(artifacts: ReportArtifacts, diff: StageDiff, context: RunContext): WeeklyBrief {
  const generatedAt = context.started_at;
  const goldenPassed = artifacts.golden_case_results.filter((result) => result.passed).length;
  const guardrails = guardrailCheck(artifacts);
  const systemStatus = goldenPassed === artifacts.golden_case_results.length && Object.values(guardrails).every(Boolean)
    ? 'ok'
    : 'review_required';

  return {
    ...artifactMetadata({
      artifact_type: 'weekly_brief',
      rule_version: context.rule_version,
      run_id: context.run_id,
      generated_at: generatedAt,
    }),
    report_id: `weekly_brief_${context.run_id}`,
    generated_at: generatedAt,
    source_artifacts: artifacts.source_artifacts,
    executive_summary: {
      dashboard_card_count: artifacts.dashboard_cards.length,
      score_count: artifacts.scores.length,
      golden_case_passed: goldenPassed,
      golden_case_total: artifacts.golden_case_results.length,
      early_radar_candidate_count: artifacts.early_radar_candidates.length,
      system_status: systemStatus,
      rule_version: artifacts.system_summary.rule_version,
    },
    stage_snapshot: stageSnapshots(artifacts),
    stage_change_summary: {
      previous_snapshot_id: diff.previous_snapshot_id,
      current_snapshot_id: diff.current_snapshot_id,
      upgrade_count: diff.summary.stage_upgrade_count,
      downgrade_count: diff.summary.stage_downgrade_count,
      evidence_added_count: diff.summary.evidence_added_count,
      branch_mutation_candidate_count: diff.summary.branch_mutation_candidate_count,
      guardrail_regression_count: diff.summary.guardrail_regression_count,
    },
    stage_changes: stageChanges(diff),
    strongest_evidence: strongestEvidence(artifacts),
    why_not_higher: whyNotHigher(artifacts),
    early_radar_candidates: earlyRadarCandidates(artifacts),
    guardrail_check: guardrails,
    next_operator_actions: nextOperatorActions(artifacts),
    artifact_index: artifacts.source_artifacts,
  };
}
