import type { GoldenCase } from '../domain/golden_case';
import type { ScoreDetails, ScoreResult } from '../domain/scoring';
import type { EvidenceNode } from '../domain/evidence';
import type { DashboardBranch, DashboardCard, DashboardEvent, ResearchAction } from './dashboard_card_service';
import { createDashboardCard } from './dashboard_card_service';
import type { StageSnapshot } from '../domain/stages';

function defaultScores(evidence: EvidenceNode[]): ScoreDetails {
  if (evidence.length === 0) {
    throw new Error('Dashboard Card generation requires evidence IDs for traceability');
  }

  const evidenceIds = evidence.map((item) => item.evidence_id);
  return {
    data_confidence: {
      score: 70,
      evidence_ids: evidenceIds,
      reasoning: 'Generated from structured evidence IDs; production scores should come from Scoring Engine where available.',
      missing_data: ['full scoring-engine dimensions'],
      confidence: 70,
    },
  };
}

function defaultStageSnapshot(goldenCase: GoldenCase, evidence: EvidenceNode[]): StageSnapshot {
  return {
    current_stage: goldenCase.required_outputs.current_stage,
    max_allowed_stage: goldenCase.required_outputs.current_stage,
    why_not_higher_stage: goldenCase.required_outputs.must_include.join('; '),
    evidence_ids: evidence.map((item) => item.evidence_id),
    data_confidence_cap_applied: false,
  };
}

function actionForGoldenCase(topicId: string): ResearchAction {
  return topicId === 'bci' ? 'validation tracking' : 'validation tracking';
}

function publicFailureSignal(marker: string): string {
  const mapped: Record<string, string> = {
    parent_stage_S6_without_parent_reality: 'Do not classify the parent narrative as S6 without parent-level hard reality evidence.',
    classify_as_S3_without_explanation: 'Do not downgrade a validated narrative to S3 without evidence-based explanation.',
    ignore_valuation_friction: 'Do not ignore valuation friction, crowding, or good-news fatigue.',
    treat_headline_deal_value_as_full_reality: 'Do not treat headline deal value as fully realized cash flow or business validation.',
    ignore_partner_quality: 'Do not ignore partner quality, clinical execution, or regulatory risk.',
  };

  return mapped[marker] ?? marker.replaceAll('_', ' ');
}

function buildKeyEvents(evidence: EvidenceNode[], mustInclude: string[]): DashboardEvent[] {
  return evidence.map((item, index) => ({
    evidence_id: item.evidence_id,
    event_title: item.event_title,
    reason_used: item.interpretation ?? item.stage_effect ?? mustInclude[index % Math.max(1, mustInclude.length)],
  }));
}

function buildKeyBranches(goldenCase: GoldenCase, evidence: EvidenceNode[]): DashboardBranch[] {
  const branchEvidence = evidence.filter((item) => item.parent_or_branch === 'branch');
  const branchIds = Array.from(new Set(branchEvidence.map((item) => item.branch_id ?? 'unknown_branch')));

  return branchIds.map((branchId) => {
    const rows = branchEvidence.filter((item) => (item.branch_id ?? 'unknown_branch') === branchId);
    const coverage = rows.length
      ? rows.reduce((sum, item) => sum + (item.branch_coverage_score ?? 0), 0) / rows.length
      : 0;

    return {
      branch_id: branchId,
      branch_name: branchId.replace(/_/g, ' '),
      current_stage: branchId === 'bci_medical_rehab'
        ? goldenCase.required_outputs.branch_medical_rehab_stage ?? 'S5-S6'
        : goldenCase.required_outputs.current_stage,
      evidence_ids: rows.map((item) => item.evidence_id),
      branch_coverage_score: Math.round(coverage),
      parent_lift_assessment: 'Branch evidence is tracked separately and cannot automatically upgrade the parent narrative.',
    };
  });
}

export function generateDashboardCardFromGoldenCase(
  goldenCase: GoldenCase,
  evidence: EvidenceNode[],
  scoreResult?: ScoreResult,
  stageSnapshot: StageSnapshot = scoreResult?.stage_snapshot ?? defaultStageSnapshot(goldenCase, evidence),
): DashboardCard {
  const mustInclude = goldenCase.required_outputs.must_include;
  const publicFailureSignals = goldenCase.forbidden_outputs.filter(
    (item) => item !== 'direct_buy_or_sell_instruction',
  ).map(publicFailureSignal);
  const evidenceIds = evidence.map((item) => item.evidence_id);

  return createDashboardCard({
    card_id: `card_${goldenCase.topic_id}`,
    topic_id: goldenCase.topic_id,
    topic_name: goldenCase.topic_name,
    as_of_date: '2026-07-05',
    current_stage: goldenCase.required_outputs.current_stage,
    transition_target: goldenCase.transition_target,
    stage_confidence: 70,
    stage_reasoning: goldenCase.key_judgment,
    why_not_lower_stage: 'The golden case includes enough structured evidence to support its baseline lifecycle stage.',
    why_not_higher_stage: mustInclude.length > 0
      ? `Upgrade is capped by required checks: ${mustInclude.join('; ')}.`
      : 'Upgrade requires additional evidence.',
    stage_snapshot: stageSnapshot,
    parent_narrative: goldenCase.topic_name,
    key_branches: buildKeyBranches(goldenCase, evidence),
    key_events: buildKeyEvents(evidence, mustInclude),
    evidence_ids: evidenceIds,
    score_id: scoreResult?.score_id ?? `score_${goldenCase.topic_id}_generated`,
    scores: scoreResult?.dimensions ?? defaultScores(evidence),
    data_confidence: scoreResult?.dimensions.data_confidence?.score ?? 70,
    narrative_memory_status: goldenCase.signal_origin ?? 'golden_case_baseline',
    next_triggers: ['Fill missing evidence listed in why_not_higher_stage.', 'Re-run stage gates before scoring.'],
    failure_signals: publicFailureSignals,
    action: actionForGoldenCase(goldenCase.topic_id),
    review_window: 'weekly',
  });
}
