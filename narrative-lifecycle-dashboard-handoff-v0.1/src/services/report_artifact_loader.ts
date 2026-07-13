import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DashboardCard } from './dashboard_card_service';
import type { EarlyRadarCandidate } from './early_radar_service';
import type { ScoreResult } from '../domain/scoring';
import type { StageDiff } from '../types/diff';

export const RUN_PIPELINE_FIRST = 'Please run npm run pipeline first.';

export interface GoldenCaseArtifact {
  topic_id: string;
  expected_stage: string;
  actual_stage: string;
  passed: boolean;
  failures: string[];
  stage_snapshot: {
    current_stage: string;
    max_allowed_stage: string;
    why_not_higher_stage: string;
    evidence_ids: string[];
    data_confidence_cap_applied: boolean;
    data_confidence_cap_reason?: string;
  };
}

export interface PipelineSystemSummaryArtifact {
  run_id: string;
  generated_at: string;
  rule_version: string;
  mission: string;
  guardrails: string[];
  produced_artifacts: Record<string, unknown>;
}

export function loadCanonicalStageDiff(repoRoot: string): StageDiff {
  return readJson<StageDiff>(repoRoot, 'outputs/diffs/latest_stage_diff.json');
}

export interface EvaluationSummaryArtifact {
  generated_at: string;
  rule_version: string;
  calibration: Array<{
    case_id: string;
    status: string;
    corrective_rules: string[];
    evaluation_ids: string[];
  }>;
}

export interface ReportArtifacts {
  dashboard_cards: DashboardCard[];
  scores: ScoreResult[];
  golden_case_results: GoldenCaseArtifact[];
  early_radar_candidates: EarlyRadarCandidate[];
  evaluation_summary: EvaluationSummaryArtifact;
  system_summary: PipelineSystemSummaryArtifact;
  source_artifacts: string[];
}

function readJson<T>(repoRoot: string, relativePath: string): T {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) {
    throw new Error(RUN_PIPELINE_FIRST);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readJsonDirectory<T>(repoRoot: string, relativeDirectory: string): { values: T[]; files: string[] } {
  const directory = resolve(repoRoot, relativeDirectory);
  if (!existsSync(directory)) {
    throw new Error(RUN_PIPELINE_FIRST);
  }
  const files = readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => `${relativeDirectory}/${file}`);

  if (files.length === 0) {
    throw new Error(RUN_PIPELINE_FIRST);
  }

  return {
    values: files.map((file) => readJson<T>(repoRoot, file)),
    files,
  };
}

export function loadReportArtifacts(repoRoot: string): ReportArtifacts {
  const cards = readJsonDirectory<DashboardCard>(repoRoot, 'outputs/dashboard_cards');
  const scores = readJsonDirectory<ScoreResult>(repoRoot, 'outputs/scores');
  const goldenCaseResults = readJson<GoldenCaseArtifact[]>(repoRoot, 'outputs/golden_case_results.json');
  const earlyRadarCandidates = readJson<EarlyRadarCandidate[]>(repoRoot, 'outputs/early_radar_candidates.json');
  const evaluationSummary = readJson<EvaluationSummaryArtifact>(repoRoot, 'outputs/evaluation_summary.json');
  const systemSummary = readJson<PipelineSystemSummaryArtifact>(repoRoot, 'outputs/system_summary.json');

  return {
    dashboard_cards: cards.values,
    scores: scores.values,
    golden_case_results: goldenCaseResults,
    early_radar_candidates: earlyRadarCandidates,
    evaluation_summary: evaluationSummary,
    system_summary: systemSummary,
    source_artifacts: [
      ...cards.files,
      ...scores.files,
      'outputs/golden_case_results.json',
      'outputs/early_radar_candidates.json',
      'outputs/evaluation_summary.json',
      'outputs/system_summary.json',
    ],
  };
}
