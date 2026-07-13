import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import type { SchemaValidator } from '../application/ports/system';
import { ImportEvidenceUseCase } from '../application/use_cases/import_evidence_use_case';
import { RunPipelineUseCase } from '../application/use_cases/run_pipeline_use_case';
import { BuildDiffUseCase } from '../application/use_cases/build_diff_use_case';
import { BuildWeeklyBriefUseCase } from '../application/use_cases/build_weekly_brief_use_case';
import { BuildOperatorReviewUseCase } from '../application/use_cases/build_operator_review_use_case';
import { RunWeeklyUseCase } from '../application/use_cases/run_weekly_use_case';
import { PilotInitUseCase, PilotReviewUseCase } from '../application/use_cases/pilot_use_cases';
import { ReplayUseCase } from '../application/use_cases/replay_use_case';
import { loadDiffArtifacts, loadPreviousSnapshot } from '../services/diff_artifact_loader';
import { normalizeEvidenceImport } from '../application/evidence_import_normalizer';
import {
  loadEvidenceImportDraft,
  validateEvidenceImport,
  writeAcceptedEvidenceImport,
  writeEvidenceValidationReport,
  writeRejectedEvidenceImport,
} from './evidence_import_io';
import { buildOperatorReview } from '../services/operator_review_aggregator';
import { loadOperatorReviewArtifacts } from '../services/operator_review_loader';
import { renderOperatorReviewMarkdown } from '../services/operator_review_markdown_renderer';
import { writePipelineOutputs } from '../services/pipeline_runner';
import { loadCanonicalStageDiff, loadReportArtifacts } from '../services/report_artifact_loader';
import { buildWeeklyBrief } from '../services/report_builder';
import { renderWeeklyBriefMarkdown } from '../services/report_markdown_renderer';
import { createRunContext } from './run_context';
import { writeJsonAtomically, writeRunManifest, writeTextAtomically } from '../services/run_manifest_writer';
import { buildStageDiff } from '../services/stage_diff_engine';
import { renderStageDiffMarkdown } from '../services/stage_diff_markdown_renderer';
import { writeStageHistory } from '../services/stage_history_writer';
import { buildStageSnapshot } from '../services/stage_snapshot_builder';
import type { StageDiff } from '../types/diff';
import { artifactMetadata } from '../types/artifact_contract';
import type { RunContext, RunManifest } from '../types/run_context';
import { FilePilotRepository } from './pilot_io';
import { renderPilotLedgerMarkdown } from '../interface/pilot_markdown_renderer';
import { FileReplayRepository } from './replay_io';
import { renderReplayLedgerMarkdown } from '../interface/replay_markdown_renderer';

export class YamlLoader {
  constructor(private readonly repoRoot: string) {}
  read<T>(relativePath: string): T {
    return parse(readFileSync(resolve(this.repoRoot, relativePath), 'utf8')) as T;
  }
}

export class FileSchemaValidator implements SchemaValidator {
  constructor(private readonly repoRoot: string) {}
  validate(schemaFile: string, value: unknown): void {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const schema = JSON.parse(readFileSync(resolve(this.repoRoot, 'schemas', schemaFile), 'utf8')) as object;
    const validator = ajv.compile(schema);
    if (!validator(value)) throw new Error(`${schemaFile} validation failed: ${JSON.stringify(validator.errors)}`);
  }
}

export class AtomicWriter {
  writeJson(path: string, value: unknown): void { writeJsonAtomically(path, value); }
  writeText(path: string, value: string): void { writeTextAtomically(path, value); }
}

export class SystemClock {
  now(): Date { return new Date(); }
}

export class FileArtifactRepository {
  constructor(private readonly repoRoot: string) {}
  readPipelineArtifacts(): unknown { return loadReportArtifacts(this.repoRoot); }
  writePipelineArtifacts(value: unknown): void { void value; }
  readWeeklyBrief() { return JSON.parse(readFileSync(resolve(this.repoRoot, 'outputs/reports/weekly_brief.json'), 'utf8')); }
  writeWeeklyBrief(report: unknown, markdown: string): void {
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/reports/weekly_brief.json'), report);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/reports/weekly_brief.md'), markdown);
  }
}

export class FileRunRepository {
  constructor(private readonly repoRoot: string) {}
  readLatestRun(): RunManifest | null {
    try { return JSON.parse(readFileSync(resolve(this.repoRoot, 'outputs/runs/latest_run.json'), 'utf8')) as RunManifest; } catch { return null; }
  }
  listRunManifests(): RunManifest[] {
    return loadOperatorReviewArtifacts(this.repoRoot).map((artifact) => artifact.manifest);
  }
  writeRunManifest(manifest: RunManifest, updateLatest: boolean): void {
    writeRunManifest(this.repoRoot, manifest, updateLatest);
  }
}

export class FileHistoryRepository {
  constructor(private readonly repoRoot: string) {}
  readLatestSnapshot() { return loadPreviousSnapshot(this.repoRoot); }
  writeSnapshot(snapshot: Parameters<typeof writeStageHistory>[1]): void { writeStageHistory(this.repoRoot, snapshot); }
  writeDiff(diff: StageDiff, markdown: string): void {
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/diffs/latest_stage_diff.json'), diff);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/diffs/latest_stage_diff.md'), markdown);
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/runs', diff.run_id, 'stage_diff.json'), diff);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/runs', diff.run_id, 'stage_diff.md'), markdown);
  }
}

export class FileReviewRepository {
  constructor(private readonly repoRoot: string) {}
  writeOperatorReview(review: ReturnType<typeof buildOperatorReview>, markdown: string): void {
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/reviews/latest_operator_review.json'), review);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/reviews/latest_operator_review.md'), markdown);
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/reviews/history', `${review.review_id}.json`), review);
  }
}

function buildDiff(repoRoot: string, validator: SchemaValidator, context: RunContext) {
  const artifacts = loadDiffArtifacts(repoRoot);
  const previous = loadPreviousSnapshot(repoRoot, context);
  const current = buildStageSnapshot(artifacts, context);
  const diff = buildStageDiff(current, previous);
  validator.validate('stage_snapshot_history.schema.json', current);
  validator.validate('stage_diff.schema.json', diff);
  return { current, diff, markdown: renderStageDiffMarkdown(diff) };
}

function buildWeekly(repoRoot: string, validator: SchemaValidator, context?: RunContext) {
  const diff = loadCanonicalStageDiff(repoRoot);
  const actualContext = context ?? {
    run_id: diff.run_id,
    started_at: diff.generated_at,
    rule_version: diff.rule_version,
    artifact_version: diff.producer_version,
  };
  const report = buildWeeklyBrief(loadReportArtifacts(repoRoot), diff, actualContext);
  validator.validate('weekly_brief.schema.json', report);
  return { report, markdown: renderWeeklyBriefMarkdown(report) };
}

export function createProductCoreUseCases(repoRoot: string) {
  const validator = new FileSchemaValidator(repoRoot);
  const runRepository = new FileRunRepository(repoRoot);
  const historyRepository = new FileHistoryRepository(repoRoot);
  const artifactRepository = new FileArtifactRepository(repoRoot);
  const reviewRepository = new FileReviewRepository(repoRoot);
  const pilotRepository = new FilePilotRepository(repoRoot);
  const replayRepository = new FileReplayRepository(repoRoot);

  const importEvidenceUseCase = new ImportEvidenceUseCase({
    loadDraft: (file) => loadEvidenceImportDraft(repoRoot, file),
    readDraftSource: (file) => readFileSync(resolve(repoRoot, file), 'utf8'),
    validate: ({ drafts, sourceFile }) => validateEvidenceImport({ repoRoot, drafts, sourceFile }),
    normalize: ({ drafts, sourceFile }) => normalizeEvidenceImport({ drafts, sourceFile }),
    writeValidationReport: (report) => writeEvidenceValidationReport(repoRoot, report as Parameters<typeof writeEvidenceValidationReport>[1]),
    writeAcceptedImport: (report, normalized) => writeAcceptedEvidenceImport(repoRoot, report as Parameters<typeof writeAcceptedEvidenceImport>[1], normalized as Parameters<typeof writeAcceptedEvidenceImport>[2]),
    writeRejectedImport: (report, sourceBody) => writeRejectedEvidenceImport(repoRoot, report as Parameters<typeof writeRejectedEvidenceImport>[1], sourceBody),
  });

  const runPipelineUseCase = new RunPipelineUseCase({
    writePipelineOutputs: (outputDir, context) => writePipelineOutputs(repoRoot, outputDir, context),
  });

  const buildDiffUseCase = new BuildDiffUseCase({
    build: (context) => {
      const result = buildDiff(repoRoot, validator, context);
      return { diff: result.diff, markdown: result.markdown };
    },
    persist: (result, context) => {
      const current = buildStageSnapshot(loadDiffArtifacts(repoRoot), context);
      historyRepository.writeSnapshot(current);
      historyRepository.writeDiff(result.diff, result.markdown);
    },
  });

  const buildWeeklyBriefUseCase = new BuildWeeklyBriefUseCase({
    build: (context) => buildWeekly(repoRoot, validator, context),
    persist: (result, context) => {
      artifactRepository.writeWeeklyBrief(result.report, result.markdown);
      writeJsonAtomically(resolve(repoRoot, 'outputs/history/report_runs', `${result.report.report_id}.json`), result.report);
      writeJsonAtomically(resolve(repoRoot, 'outputs/runs', context.run_id, 'weekly_brief.json'), result.report);
      writeTextAtomically(resolve(repoRoot, 'outputs/runs', context.run_id, 'weekly_brief.md'), result.markdown);
    },
  });

  const buildOperatorReviewUseCase = new BuildOperatorReviewUseCase({
    build: () => {
      const review = buildOperatorReview(loadOperatorReviewArtifacts(repoRoot));
      validator.validate('operator_review.schema.json', review);
      return { review, markdown: renderOperatorReviewMarkdown(review) };
    },
    persist: (result) => reviewRepository.writeOperatorReview(result.review, result.markdown),
  });

  const runWeeklyUseCase = new RunWeeklyUseCase({
    createRunContext,
    runPipeline: (context) => { runPipelineUseCase.execute(context); },
    runDiff: (context) => { buildDiffUseCase.execute(context); },
    runReport: (context) => { buildWeeklyBriefUseCase.execute(context); },
    buildManifest: (context, failedCommand) => {
      const diff = failedCommand ? null : loadCanonicalStageDiff(repoRoot);
      const latest = runRepository.readLatestRun();
      return {
        ...artifactMetadata({
          artifact_type: 'run_manifest',
          rule_version: context.rule_version,
          run_id: context.run_id,
          generated_at: context.started_at,
        }),
        ...context,
        completed_at: new Date().toISOString(),
        status: failedCommand ? 'failed' : 'ok',
        commands: failedCommand ? ['pipeline', 'diff', 'report'].slice(0, ['pipeline', 'diff', 'report'].indexOf(failedCommand) + 1) : ['pipeline', 'diff', 'report'],
        artifacts: failedCommand ? [] : [
          `outputs/runs/${context.run_id}/stage_snapshot.json`,
          `outputs/runs/${context.run_id}/stage_diff.json`,
          `outputs/runs/${context.run_id}/stage_diff.md`,
          `outputs/runs/${context.run_id}/weekly_brief.json`,
          `outputs/runs/${context.run_id}/weekly_brief.md`,
        ],
        previous_run_id: latest?.run_id ?? null,
        current_snapshot_id: diff?.current_snapshot_id ?? null,
        previous_snapshot_id: diff?.previous_snapshot_id ?? null,
        guardrail_status: diff?.guardrail_changes.length ? 'review_required' : 'ok',
      } satisfies RunManifest;
    },
    validateManifest: (manifest) => validator.validate('run_manifest.schema.json', manifest),
    writeManifest: (manifest, updateLatest) => runRepository.writeRunManifest(manifest, updateLatest),
  });

  const pilotInitUseCase = new PilotInitUseCase({
    readWeeklyBrief: () => pilotRepository.readWeeklyBrief(),
    writePilotSeed: (topics, observations) => pilotRepository.writePilotSeed(topics, observations),
    pilotFilesExist: () => pilotRepository.pilotFilesExist(),
  });

  const pilotReviewUseCase = new PilotReviewUseCase({
    readLatestRun: () => pilotRepository.readLatestRun(),
    readWeeklyBrief: () => pilotRepository.readWeeklyBrief(),
    readStageDiff: () => pilotRepository.readStageDiff(),
    readOperatorReview: () => pilotRepository.readOperatorReview(),
    readPilotTopics: () => pilotRepository.readPilotTopics(),
    readPilotObservations: () => pilotRepository.readPilotObservations(),
    writePilotLedger: (ledger, markdown) => pilotRepository.writePilotLedger(ledger, markdown),
    writePilotEvaluationSummary: (summary) => pilotRepository.writePilotEvaluationSummary(summary),
    renderMarkdown: renderPilotLedgerMarkdown,
    validateLedger: (ledger) => validator.validate('pilot_research_ledger.schema.json', ledger),
    validateEvaluationSummary: (summary) => validator.validate('pilot_evaluation_summary.schema.json', summary),
    sourceArtifacts: () => pilotRepository.sourceArtifacts(),
  });

  const replayUseCase = new ReplayUseCase({
    readReplayCases: () => replayRepository.readReplayCases(),
    readLatestRun: () => replayRepository.readLatestRun(),
    writeReplayLedger: (ledger, markdown) => replayRepository.writeReplayLedger(ledger, markdown),
    renderMarkdown: renderReplayLedgerMarkdown,
    validateLedger: (ledger) => validator.validate('replay_ledger.schema.json', ledger),
    sourceArtifacts: () => replayRepository.sourceArtifacts(),
    now: () => new Date().toISOString(),
  });

  return {
    importEvidenceUseCase,
    runPipelineUseCase,
    buildDiffUseCase,
    buildWeeklyBriefUseCase,
    buildOperatorReviewUseCase,
    runWeeklyUseCase,
    pilotInitUseCase,
    pilotReviewUseCase,
    replayUseCase,
    validator,
  };
}
