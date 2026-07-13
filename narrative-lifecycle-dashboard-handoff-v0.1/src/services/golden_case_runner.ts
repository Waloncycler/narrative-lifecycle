import type { EvidenceNode } from '../domain/evidence';
import type { GoldenCase } from '../domain/golden_case';
import type { ScoreResult } from '../domain/scoring';
import { maxStageInExpression } from '../domain/stages';
import type { DashboardCard } from './dashboard_card_service';
import { generateDashboardCardFromGoldenCase } from './dashboard_card_generator';
import { generateScore } from './scoring_engine';
import { classifyStage, type StageClassification } from './stage_classifier';

export interface GoldenCaseRunResult {
  topic_id: string;
  expected_stage: string;
  actual_stage: string;
  passed: boolean;
  failures: string[];
  stage: StageClassification;
  score: ScoreResult;
  dashboard_card: DashboardCard;
}

function topicEvidence(evidence: EvidenceNode[], topicId: string): EvidenceNode[] {
  return evidence.filter((item) => item.topic_id === topicId);
}

function averageConfidence(evidence: EvidenceNode[]): number {
  const values = evidence.map((item) => item.confidence).filter((value): value is number => typeof value === 'number');
  if (values.length === 0) return 70;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function containsForbiddenOutput(card: DashboardCard, forbiddenOutput: string): boolean {
  if (forbiddenOutput === 'direct_buy_or_sell_instruction') {
    return /\b(buy|sell|target price|entry|exit|position sizing)\b/i.test(JSON.stringify(card));
  }
  return JSON.stringify(card).includes(forbiddenOutput);
}

export function runGoldenCase(goldenCase: GoldenCase, evidence: EvidenceNode[], asOfDate = '2026-07-05'): GoldenCaseRunResult {
  const evidenceForTopic = topicEvidence(evidence, goldenCase.topic_id);
  const requestedStage = maxStageInExpression(goldenCase.required_outputs.current_stage);
  const dataConfidence = averageConfidence(evidenceForTopic);
  const stage = classifyStage({
    evidence: evidenceForTopic,
    scope: 'parent',
    requestedStage,
    dataConfidence,
  });
  const score = generateScore({
    score_id: `score_${goldenCase.topic_id}_${asOfDate.replaceAll('-', '_')}`,
    topic_id: goldenCase.topic_id,
    score_date: asOfDate,
    evidence: evidenceForTopic,
    stageClassification: stage,
  });
  const dashboardCard = generateDashboardCardFromGoldenCase(goldenCase, evidenceForTopic, score);
  const cardText = JSON.stringify(dashboardCard);
  const failures = [
    ...goldenCase.required_outputs.must_include
      .filter((required) => !cardText.includes(required))
      .map((required) => `missing required output: ${required}`),
    ...goldenCase.forbidden_outputs
      .filter((forbidden) => containsForbiddenOutput(dashboardCard, forbidden))
      .map((forbidden) => `contains forbidden output: ${forbidden}`),
  ];

  if (dashboardCard.current_stage !== goldenCase.required_outputs.current_stage) {
    failures.push(`stage mismatch: expected ${goldenCase.required_outputs.current_stage}, got ${dashboardCard.current_stage}`);
  }

  if (stage.current_stage !== requestedStage) {
    failures.push(`stage gate mismatch: expected parent stage ${requestedStage}, got ${stage.current_stage}`);
  }

  return {
    topic_id: goldenCase.topic_id,
    expected_stage: goldenCase.required_outputs.current_stage,
    actual_stage: dashboardCard.current_stage,
    passed: failures.length === 0,
    failures,
    stage,
    score,
    dashboard_card: dashboardCard,
  };
}

export function runGoldenCases(goldenCases: GoldenCase[], evidence: EvidenceNode[], asOfDate = '2026-07-05'): GoldenCaseRunResult[] {
  return goldenCases.map((goldenCase) => runGoldenCase(goldenCase, evidence, asOfDate));
}
