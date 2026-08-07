import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { DashboardCard } from './dashboard_card_service';
import { createEarlyRadarCandidate, type EarlyRadarCandidate } from './early_radar_service';
import { calibrateFailureCases, type FailureCaseCalibration } from './evaluation_service';
import { MemoryService } from './memory_service';
import { createReactivationRecord } from './reactivation_service';
import {
  FileEvaluationRepository,
  FileEvidenceRepository,
  FileFailureCaseRepository,
  FileGoldenCaseRepository,
  FileMemoryRepository,
  FileTopicRepository,
  YamlFileRepository,
} from '../repositories/file_repository';
import { runGoldenCases, type GoldenCaseRunResult } from './golden_case_runner';
import { RULE_VERSION } from '../domain/versioning_service';
import type { RunContext } from '../types/run_context';
import { createRunContext } from './run_context';

export interface PipelineArtifactSummary {
  output_dir: string;
  run_id: string;
  generated_at: string;
  rule_version: string;
  golden_results: Array<{
    topic_id: string;
    expected_stage: string;
    actual_stage: string;
    passed: boolean;
    failures: string[];
  }>;
  dashboard_card_files: string[];
  score_files: string[];
  early_radar_count: number;
  evaluation_summary_file: string;
}

export interface PipelineRun {
  generated_at: string;
  golden_results: GoldenCaseRunResult[];
  dashboard_cards: DashboardCard[];
  scores: GoldenCaseRunResult['score'][];
  early_radar_candidates: EarlyRadarCandidate[];
  evaluation_calibration: FailureCaseCalibration[];
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function validateSchema(repoRoot: string, schemaFile: string, value: unknown): void {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(resolve(repoRoot, 'schemas', schemaFile), 'utf8'));
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    throw new Error(`${schemaFile} validation failed: ${JSON.stringify(validate.errors)}`);
  }
}

function buildEarlyRadarCandidates(goldenResults: GoldenCaseRunResult[], repoRoot: string): EarlyRadarCandidate[] {
  const files = new YamlFileRepository(repoRoot);
  const memoryService = new MemoryService(
    new FileMemoryRepository(new FileTopicRepository(files)).listSeedMemories(),
  );

  return goldenResults.flatMap((result) => {
    if (result.topic_id !== 'bci') return [];

    const memory = memoryService.lookup(result.topic_id);
    const reactivation = createReactivationRecord({
      record_id: `reactivation_${result.topic_id}_${result.stage.current_stage}`,
      topic_id: result.topic_id,
      memory,
      repeatedOldLogic: false,
      missingEvidenceFilled: ['branch reality upgrade'],
      branchMutationStrength: 0,
      realityCatchUp: true,
      expectationReset: 10,
      newEvidenceQuality: 70,
      stageGateImpact: 60,
      dataConfidence: result.dashboard_card.data_confidence,
    });

    return [
      createEarlyRadarCandidate({
        candidate_id: `radar_${result.topic_id}`,
        candidate_name: result.dashboard_card.topic_name,
        parent_narrative: result.dashboard_card.parent_narrative,
        current_stage: result.stage.current_stage,
        transition_target: result.dashboard_card.transition_target,
        reactivation_type: reactivation.reactivation_type,
        signal_origin: reactivation.reactivation_type,
        reactivation_record_id: reactivation.record_id,
        narrative_delta_score: reactivation.narrative_delta_score,
        data_confidence: result.dashboard_card.data_confidence,
        why_early: 'Old theme reactivation has new branch reality evidence, but parent gates remain incomplete.',
        why_not_confirmed: result.stage.why_not_higher_stage,
        next_triggers: result.dashboard_card.next_triggers,
        failure_signals: result.dashboard_card.failure_signals,
        suggested_action: 'early research',
      }),
    ];
  });
}

export function runPipeline(repoRoot: string, generatedAt = new Date().toISOString()): PipelineRun {
  const files = new YamlFileRepository(repoRoot);
  const goldenCases = new FileGoldenCaseRepository(files).listGoldenCases();
  const evidence = new FileEvidenceRepository(files).listSampleEvidence();
  const failureCases = new FileFailureCaseRepository(files).listFailureCases();
  const evaluations = new FileEvaluationRepository(files).listEvaluationResults();
  const goldenResults = runGoldenCases(goldenCases, evidence);
  const earlyRadarCandidates = buildEarlyRadarCandidates(goldenResults, repoRoot);

  return {
    generated_at: generatedAt,
    golden_results: goldenResults,
    dashboard_cards: goldenResults.map((result) => result.dashboard_card),
    scores: goldenResults.map((result) => result.score),
    early_radar_candidates: earlyRadarCandidates,
    evaluation_calibration: calibrateFailureCases(failureCases, evaluations),
  };
}

export function writePipelineOutputs(repoRoot: string, outputDir = 'outputs', context: RunContext = createRunContext()): PipelineArtifactSummary {
  const outputRoot = resolve(repoRoot, outputDir);
  const cardsDir = resolve(outputRoot, 'dashboard_cards');
  const scoresDir = resolve(outputRoot, 'scores');
  rmSync(cardsDir, { recursive: true, force: true });
  rmSync(scoresDir, { recursive: true, force: true });
  mkdirSync(cardsDir, { recursive: true });
  mkdirSync(scoresDir, { recursive: true });

  const pipeline = runPipeline(repoRoot, context.started_at);
  const dashboardCardFiles: string[] = [];
  const scoreFiles: string[] = [];

  for (const card of pipeline.dashboard_cards) {
    validateSchema(repoRoot, 'dashboard_card.schema.json', card);
    const relativePath = `${outputDir}/dashboard_cards/${card.topic_id}.json`;
    writeJson(resolve(repoRoot, relativePath), card);
    dashboardCardFiles.push(relativePath);
  }

  for (const score of pipeline.scores) {
    validateSchema(repoRoot, 'score.schema.json', score);
    const relativePath = `${outputDir}/scores/${score.topic_id}.json`;
    writeJson(resolve(repoRoot, relativePath), score);
    scoreFiles.push(relativePath);
  }

  for (const candidate of pipeline.early_radar_candidates) {
    validateSchema(repoRoot, 'early_radar_candidate.schema.json', candidate);
  }

  const goldenResults = pipeline.golden_results.map((result) => ({
    topic_id: result.topic_id,
    expected_stage: result.expected_stage,
    actual_stage: result.actual_stage,
    passed: result.passed,
    failures: result.failures,
    stage_snapshot: result.score.stage_snapshot,
  }));
  const evaluationSummary = {
    generated_at: pipeline.generated_at,
    rule_version: RULE_VERSION,
    calibration: pipeline.evaluation_calibration,
  };
  const systemSummary = {
    run_id: context.run_id,
    generated_at: pipeline.generated_at,
    rule_version: RULE_VERSION,
    mission: 'Evidence-first narrative lifecycle decision-support system. Not a trading system.',
    guardrails: [
      'Evidence Table First',
      'Stage First, Score Second',
      'No Evidence Table, no scoring',
      'Parent and branch narratives are judged separately',
      'Narrative Memory before Early Radar for old themes',
      'No buy/sell advice, target prices, position sizing, or execution language',
    ],
    produced_artifacts: {
      dashboard_cards: dashboardCardFiles,
      scores: scoreFiles,
      golden_results: `${outputDir}/golden_case_results.json`,
      early_radar: `${outputDir}/early_radar_candidates.json`,
      evaluation_summary: `${outputDir}/evaluation_summary.json`,
    },
  };

  writeJson(resolve(outputRoot, 'golden_case_results.json'), goldenResults);
  writeJson(resolve(outputRoot, 'early_radar_candidates.json'), pipeline.early_radar_candidates);
  writeJson(resolve(outputRoot, 'evaluation_summary.json'), evaluationSummary);
  writeJson(resolve(outputRoot, 'system_summary.json'), systemSummary);

  const summary: PipelineArtifactSummary = {
    output_dir: outputDir,
    run_id: context.run_id,
    generated_at: pipeline.generated_at,
    rule_version: RULE_VERSION,
    golden_results: goldenResults.map(({ topic_id, expected_stage, actual_stage, passed, failures }) => ({
      topic_id,
      expected_stage,
      actual_stage,
      passed,
      failures,
    })),
    dashboard_card_files: dashboardCardFiles,
    score_files: scoreFiles,
    early_radar_count: pipeline.early_radar_candidates.length,
    evaluation_summary_file: `${outputDir}/evaluation_summary.json`,
  };
  writeJson(resolve(outputRoot, 'pipeline_summary.json'), summary);
  return summary;
}
