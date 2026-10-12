import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { db } from '@/db/index';
import { genericArtifacts, stageDiffs } from '@/db/schema';
import { like } from 'drizzle-orm';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DashboardCard } from '@/features/reporting/domain/dashboard_card_service';
import type { EarlyRadarCandidate } from '@/features/reporting/domain/early_radar_service';
import type { ScoreResult } from '@/features/scoring/domain/scoring';
import type { StageDiff } from '@/features/stages/types/diff';

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
  const diffs = db.select().from(stageDiffs).orderBy(stageDiffs.generated_at).all();
  if (diffs.length === 0) throw new Error(RUN_PIPELINE_FIRST);
  return JSON.parse(diffs[diffs.length - 1].diff_json) as StageDiff;
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
  const id = relativePath.includes('outputs/') ? relativePath.substring(relativePath.indexOf('outputs/') + 8) : relativePath;
  const data = readGenericArtifact(id);
  if (!data) throw new Error(RUN_PIPELINE_FIRST);
  return data as T;
}

function readJsonDirectory<T>(repoRoot: string, relativeDirectory: string): { files: string[]; values: T[] } {
  const prefix = relativeDirectory.replace(/^outputs\//, '') + '/';
  const records = db.select().from(genericArtifacts).where(like(genericArtifacts.artifact_id, `${prefix}%`)).all();
  if (records.length > 0) {
    return {
      files: records.map(r => `${relativeDirectory}/${r.artifact_id.split('/').pop()!}`),
      values: records.map(r => JSON.parse(r.content_json) as T)
    };
  }
  throw new Error(RUN_PIPELINE_FIRST);
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
