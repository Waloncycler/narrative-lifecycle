import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import type { SchemaValidator } from '@/app/ports/system';
import { ImportEvidenceUseCase } from '@/app/use_cases/import_evidence_use_case';
import { RunPipelineUseCase } from '@/app/use_cases/run_pipeline_use_case';
import { BuildDiffUseCase } from '@/app/use_cases/build_diff_use_case';
import { BuildWeeklyBriefUseCase } from '@/app/use_cases/build_weekly_brief_use_case';
import { BuildOperatorReviewUseCase } from '@/app/use_cases/build_operator_review_use_case';
import { RunWeeklyUseCase } from '@/app/use_cases/run_weekly_use_case';
import { PilotInitUseCase, PilotReviewUseCase } from '@/app/use_cases/pilot_use_cases';
import { ReplayUseCase } from '@/app/use_cases/replay_use_case';
import { ReviewIntelligenceProposalUseCase } from '@/app/use_cases/intelligence_review_use_case';
import { ApplyEvidenceIntakeReviewUseCase, BuildIntakeLearningCycleUseCase, BuildIntakeLearningProfileUseCase, EvaluateIntakeUseCase, PrepareEvidenceIntakeUseCase, RetryEvidenceIntakePipelineUseCase, RunAiShadowCorpusEvaluationUseCase, RunAiShadowValidationUseCase, ValidateTopicsUseCase } from '@/app/use_cases/intake_use_cases';
import { loadDiffArtifacts, loadPreviousSnapshot } from '@/features/stages/pipeline/diff_artifact_loader';
import { normalizeEvidenceImport } from '@/app/evidence_import_normalizer';
import {
  isIdempotentEvidenceImport,
  loadEvidenceImportDraft,
  validateEvidenceImport,
  writeAcceptedEvidenceImport,
  writeEvidenceValidationReport,
  writeRejectedEvidenceImport,
} from '@/features/evidence/io/evidence_import_io';
import { buildOperatorReview } from '@/features/reporting/pipeline/operator_review_aggregator';
import { loadOperatorReviewArtifacts } from '@/features/reporting/pipeline/operator_review_loader';
import { renderOperatorReviewMarkdown } from '@/features/reporting/pipeline/operator_review_markdown_renderer';
import { writePipelineOutputs } from '@/app/pipeline_runner';
import { loadCanonicalStageDiff, loadReportArtifacts } from '@/features/reporting/pipeline/report_artifact_loader';
import { buildWeeklyBrief } from '@/features/reporting/pipeline/report_builder';
import { renderWeeklyBriefMarkdown } from '@/features/reporting/pipeline/report_markdown_renderer';
import { createRunContext } from '@/platform/io/run_context';
import { writeJsonAtomically, writeRunManifest, writeTextAtomically } from '@/platform/io/run_manifest_writer';
import { buildStageDiff } from '@/features/stages/domain/stage_diff_engine';
import { renderStageDiffMarkdown } from '@/features/stages/pipeline/stage_diff_markdown_renderer';
import { writeStageHistory } from '@/features/stages/pipeline/stage_history_writer';
import { buildStageSnapshot } from '@/features/stages/pipeline/stage_snapshot_builder';
import type { StageDiff } from '@/features/stages/types/diff';
import type { EvidenceImportReport } from '@/features/evidence/types/evidence_import';
import type { AiShadowValidationReport, EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { NarrativeDiscoveryReport } from '@/features/narrative/types/narrative_discovery';
import { artifactMetadata } from '@/platform/types/artifact_contract';
import type { RunContext, RunManifest } from '@/platform/types/run_context';
import { FilePilotRepository } from '@/features/reporting/io/pilot_io';
import { renderPilotLedgerMarkdown } from '@/features/reporting/ui/pilot_markdown_renderer';
import { FileReplayRepository } from '@/features/reporting/io/replay_io';
import { renderReplayLedgerMarkdown } from '@/features/reporting/ui/replay_markdown_renderer';
import { FileIntakeRepository } from '@/features/intake/io/intake_io';
import { renderIntakeWorkbench } from '@/features/intake/ui/intake_workbench_renderer';
import { FileTopicRegistryRepository, ShadowAiCandidateGenerator } from '@/platform/io/topic_registry_io';
import { aiShadowConfigFromEnv, ProviderNeutralAiShadowAdapter } from '@/features/research/io/ai_shadow_provider';
import { RunIntakeAgentUseCase } from '@/app/use_cases/run_intake_agent_use_case';
import { intakeAgentConfigFromEnv, OpenAiCompatibleIntakeAgentAdapter } from '@/features/intake/io/intake_agent_provider';
import { FileIndustryPackRepository } from '@/platform/io/industry_pack_io';
import type { IntakeAgentReviewBundle } from '@/features/intake/types/intake_agent';
import { SyncWorldMonitorSourcesUseCase } from '@/app/use_cases/sync_worldmonitor_sources_use_case';
import { FileWorldMonitorSourceRepository, WorldMonitorHttpClient } from '@/features/worldmonitor/io/worldmonitor_source_adapter';
import { buildTopicResolutionAudit } from '@/features/narrative/domain/topic_resolver';
import { ResearchAgentLoopUseCase } from '@/app/use_cases/research_agent_loop_use_case';
import { FileIntelligenceRepository } from '@/platform/io/intelligence_io';
import { ResearchAgentScheduler } from '@/features/research/io/research_agent_scheduler';
import { FileResearchAgentRepository } from '@/features/research/io/research_agent_io';
import { FileAutonomousResearchRepository } from '@/features/research/io/autonomous_research_io';
import { RunAutonomousResearchUseCase } from '@/app/use_cases/run_autonomous_research_use_case';
import { ValidateAutonomousResearchPolicyUseCase } from '@/app/use_cases/validate_autonomous_research_policy_use_case';
import { RunWebResearchUseCase } from '@/app/use_cases/run_web_research_use_case';
import { FileWebResearchRepository } from '@/features/research/io/web_research_io';
import { HttpWebSearchProvider, webSearchConfigFromEnv } from '@/features/research/io/web_search_provider';
import { FileResearchCoverageRepository } from '@/features/research/io/research_coverage_io';
import { BuildResearchCampaignUseCase } from '@/app/use_cases/build_research_campaign_use_case';
import { RunResearchCampaignUseCase } from '@/app/use_cases/run_research_campaign_use_case';
import { RunDirectSourceResearchUseCase } from '@/app/use_cases/run_direct_source_research_use_case';
import { AuthoritativeDirectSourceProvider } from '@/features/research/io/authoritative_direct_source_provider';
import { PrepareDirectSourceIntakeUseCase } from '@/app/use_cases/prepare_direct_source_intake_use_case';
import { BuildResearchLeadTriageUseCase } from '@/app/use_cases/build_research_lead_triage_use_case';
import { FileResearchLeadTriageRepository } from '@/features/research/io/research_lead_triage_io';
import { RetrieveResearchSourcesUseCase } from '@/app/use_cases/retrieve_research_sources_use_case';
import { FileResearchSourceRetrievalRepository, HttpResearchSourceRetriever } from '@/features/research/io/research_source_retrieval_io';
import { BuildResearchBaselineCompletionUseCase } from '@/app/use_cases/build_research_baseline_completion_use_case';
import { FileResearchBaselineCompletionRepository } from '@/features/research/io/research_baseline_completion_io';

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

/**
 * Resolves every candidate's topic and registers new provisional topics /
 * branches into the registry, then writes the final audit. Shared by the
 * world-monitor sync (raw rule candidates) and the intake agent run (model-
 * enriched candidates) so the audit always reflects the latest candidate set.
 */
function resolveTopicsAndRegister(session: EvidenceIntakeSession, topicRegistryRepository: FileTopicRegistryRepository, discovery?: NarrativeDiscoveryReport): void {
  // Register new provisional topics/branches first, then rebuild the audit so
  // newly registered topics resolve as existing_topic in the final audit.
  const registry = topicRegistryRepository.readTopicRegistry();
  const firstPass = buildTopicResolutionAudit({
    sessionId: session.session_id,
    candidates: session.candidates,
    registry,
    generatedAt: new Date().toISOString(),
  });
  const branchNames = new Map(
    discovery?.records
      .filter((record) => record.registration_action !== 'none' && record.branch_id && record.branch_name)
      .map((record) => [record.branch_id as string, record.branch_name as string]) ?? [],
  );
  topicRegistryRepository.registerResolutions(firstPass.resolutions, new Date().toISOString(), branchNames);
  // Keep the original discovery status in the audit. Re-resolving immediately
  // after registration would turn new_provisional_topic/new_branch into
  // existing_topic and hide the discovery event from the operator.
  topicRegistryRepository.writeTopicResolutionAudit(firstPass);
}

export function createProductCoreUseCases(repoRoot: string) {
  const validator = new FileSchemaValidator(repoRoot);
  const runRepository = new FileRunRepository(repoRoot);
  const historyRepository = new FileHistoryRepository(repoRoot);
  const artifactRepository = new FileArtifactRepository(repoRoot);
  const reviewRepository = new FileReviewRepository(repoRoot);
  const pilotRepository = new FilePilotRepository(repoRoot);
  const replayRepository = new FileReplayRepository(repoRoot);
  const intakeRepository = new FileIntakeRepository(repoRoot);
  const topicRegistryRepository = new FileTopicRegistryRepository(repoRoot);
  const intelligenceRepository = new FileIntelligenceRepository(repoRoot);
  const reviewIntelligenceProposalUseCase = new ReviewIntelligenceProposalUseCase({
    readTopicProposals: () => intelligenceRepository.readTopicDiscoveryProposals(),
    readEvidenceChain: () => intelligenceRepository.readEvidenceChain(),
    writeTopicProposals: (proposals) => intelligenceRepository.writeTopicDiscoveryProposals(proposals),
    writeEvidenceChain: (entries) => intelligenceRepository.writeEvidenceChain(entries),
    now: () => new Date().toISOString(),
  });
  const shadowAiCandidateGenerator = new ShadowAiCandidateGenerator();
  const realAiShadowAdapter = new ProviderNeutralAiShadowAdapter(aiShadowConfigFromEnv(process.env));
  const intakeAgentAdapter = new OpenAiCompatibleIntakeAgentAdapter(intakeAgentConfigFromEnv(process.env));
  const industryPackRepository = new FileIndustryPackRepository(repoRoot);
  const worldMonitorApiKey = process.env.WORLDMONITOR_API_KEY ?? process.env.WORLDMONITOR_RELAY_KEY ?? null;
  const worldMonitorSourceRepository = new FileWorldMonitorSourceRepository(
    repoRoot,
    process.env.WORLDMONITOR_REFERENCE_ROOT ?? resolve(repoRoot, '../worldmonitor-main'),
  );
  const worldMonitorHttpClient = new WorldMonitorHttpClient(worldMonitorApiKey);
  const webResearchRepository = new FileWebResearchRepository(repoRoot);
  const researchCoverageRepository = new FileResearchCoverageRepository(repoRoot);
  const researchLeadTriageRepository = new FileResearchLeadTriageRepository(repoRoot);
  const researchSourceRetrievalRepository = new FileResearchSourceRetrievalRepository(repoRoot);
  const researchSourceRetriever = new HttpResearchSourceRetriever();
  const researchBaselineCompletionRepository = new FileResearchBaselineCompletionRepository(repoRoot);
  const webSearchProvider = new HttpWebSearchProvider();

  const importEvidenceUseCase = new ImportEvidenceUseCase({
    loadDraft: (file) => loadEvidenceImportDraft(repoRoot, file),
    readDraftSource: (file) => readFileSync(resolve(repoRoot, file), 'utf8'),
    validate: ({ drafts, sourceFile }) => validateEvidenceImport({ repoRoot, drafts, sourceFile }),
    normalize: ({ drafts, sourceFile }) => normalizeEvidenceImport({ drafts, sourceFile }),
    isIdempotentDuplicate: ({ drafts, sourceFile }) => isIdempotentEvidenceImport({ repoRoot, drafts, sourceFile }),
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

  const prepareEvidenceIntakeUseCase = new PrepareEvidenceIntakeUseCase({
    readRawDocument: (input) => intakeRepository.readRawDocument(input),
    existingEvidenceIds: () => intakeRepository.existingEvidenceIds(),
    writeIntakeSession: (session, workbenchHtml) => intakeRepository.writeIntakeSession(session, workbenchHtml),
    renderWorkbench: renderIntakeWorkbench,
    generateAiCandidates: (input) => shadowAiCandidateGenerator.generate(input),
    now: () => new Date().toISOString(),
  });

  const applyEvidenceIntakeReviewUseCase = new ApplyEvidenceIntakeReviewUseCase({
    readLatestSession: () => intakeRepository.readLatestSession(),
    readTopicResolutionAudit: () => topicRegistryRepository.readTopicResolutionAudit(),
    readReviewDecisions: (file) => intakeRepository.readReviewDecisions(file),
    existingEvidenceIds: () => intakeRepository.existingEvidenceIds(),
    writeEvidenceDraft: (drafts) => intakeRepository.writeEvidenceDraft(drafts),
    writeApplyResult: (result) => intakeRepository.writeApplyResult(result),
    importEvidence: (file) => {
      const result = importEvidenceUseCase.import(file);
      return { report: result.report as EvidenceImportReport, failed: result.failed };
    },
    runWeekly: () => runAutonomousResearchUseCase.execute({ publish: false }).manifest,
    readStageChangeSummary: () => intakeRepository.readStageChangeSummary(),
    now: () => new Date().toISOString(),
  });

  const retryEvidenceIntakePipelineUseCase = new RetryEvidenceIntakePipelineUseCase({
    readLatestSession: () => intakeRepository.readLatestSession(),
    readApplyResult: () => intakeRepository.readApplyResult(),
    writeApplyResult: (result) => intakeRepository.writeApplyResult(result),
    runWeekly: () => runAutonomousResearchUseCase.execute({ publish: false }).manifest,
    readStageChangeSummary: () => intakeRepository.readStageChangeSummary(),
    now: () => new Date().toISOString(),
  });

  const evaluateIntakeUseCase = new EvaluateIntakeUseCase({
    readLatestSession: () => intakeRepository.readLatestSession(),
    readReviewDecisions: (file) => intakeRepository.readReviewDecisions(file),
    readApplyResult: () => intakeRepository.readApplyResult(),
    readTopicResolutionAudit: () => topicRegistryRepository.readTopicResolutionAudit(),
    writeIntakeEvaluation: (report) => intakeRepository.writeIntakeEvaluation(report),
    validateEvaluation: (report) => validator.validate('intake_evaluation.schema.json', report),
    now: () => new Date().toISOString(),
  });

  const buildIntakeLearningProfileUseCase = new BuildIntakeLearningProfileUseCase({
    readLatestSession: () => intakeRepository.readLatestSession(),
    readReviewDecisions: (file) => intakeRepository.readReviewDecisions(file),
    readLatestEvaluation: () => intakeRepository.readLatestEvaluation(),
    readLearningProfile: () => intakeRepository.readLearningProfile(),
    writeLearningProfile: (profile) => intakeRepository.writeLearningProfile(profile),
    validateProfile: (profile) => validator.validate('intake_learning_profile.schema.json', profile),
    now: () => new Date().toISOString(),
  });

  const buildIntakeLearningCycleUseCase = new BuildIntakeLearningCycleUseCase({
    readLatestSession: () => intakeRepository.readLatestSession(),
    readLatestEvaluation: () => intakeRepository.readLatestEvaluation(),
    readLearningProfile: () => intakeRepository.readLearningProfile(),
    readPreviousLearningProfile: (profileId) => intakeRepository.readPreviousLearningProfile(profileId),
    readTopicResolutionAudit: () => topicRegistryRepository.readTopicResolutionAudit(),
    readAiShadowValidationReport: () => intakeRepository.readAiShadowValidationReport(),
    writeLearningCycle: (cycle) => intakeRepository.writeLearningCycle(cycle),
    validateCycle: (cycle) => validator.validate('intake_learning_cycle.schema.json', cycle),
    now: () => new Date().toISOString(),
  });

  const validateTopicsUseCase = new ValidateTopicsUseCase({
    readLatestSession: () => {
      try { return intakeRepository.readLatestSession(); } catch { return null; }
    },
    readTopicRegistry: () => topicRegistryRepository.readTopicRegistry(),
    writeTopicResolutionAudit: (audit) => topicRegistryRepository.writeTopicResolutionAudit(audit),
    validateTopicAudit: (audit) => validator.validate('topic_resolution_audit.schema.json', audit),
    validateRegistryReport: (report) => validator.validate('topic_registry_validation.schema.json', report),
    now: () => new Date().toISOString(),
  });

  const runAiShadowValidationUseCase = new RunAiShadowValidationUseCase({
    readLatestSession: () => intakeRepository.readLatestSession(),
    generateAiShadow: (session) => realAiShadowAdapter.generate(session),
    writeAiShadowResult: (session, audit) => intakeRepository.writeAiShadowResult(session, audit),
    writeAiShadowValidationReport: (report) => intakeRepository.writeAiShadowValidationReport(report as AiShadowValidationReport),
    validateCandidate: (candidate) => validator.validate('evidence_candidate.schema.json', candidate),
    now: () => new Date().toISOString(),
  });

  const runAiShadowCorpusEvaluationUseCase = new RunAiShadowCorpusEvaluationUseCase({
    listPilotDocuments: () => {
      const rows = parse(readFileSync(resolve(repoRoot, 'data/intake/pilot_documents/manifest.yaml'), 'utf8')) as Array<{ document_id: string; path: string }>;
      return rows;
    },
    prepareDocument: (file) => prepareEvidenceIntakeUseCase.execute({ file }),
    runAiShadow: async () => (await runAiShadowValidationUseCase.execute()).session,
    writeCorpusReport: (report) => intakeRepository.writeAiShadowCorpusReport(report as AiShadowValidationReport),
    now: () => new Date().toISOString(),
  });

  const runIntakeAgentUseCase = new RunIntakeAgentUseCase({
    prepare: (input) => prepareEvidenceIntakeUseCase.execute(input),
    readLatest: () => intakeRepository.readLatestSession(),
    readIndustryPacks: () => industryPackRepository.readIndustryPacks(),
    readLearningProfile: () => intakeRepository.readLearningProfile(),
    readTopicRegistry: () => topicRegistryRepository.readTopicRegistry(),
    readDiff: () => {
      try { return loadCanonicalStageDiff(repoRoot); } catch { return null; }
    },
    generate: (session, industryPacks, learningProfile, topicRegistry, evidenceNodes, diff) => intakeAgentAdapter.generate(session, industryPacks, learningProfile, topicRegistry, evidenceNodes, diff),
    readTopicResolutionAudit: () => topicRegistryRepository.readTopicResolutionAudit(),
    readEvidenceNodes: () => intakeRepository.readEvidenceNodes(),
    writeTopicDiscoveryProposals: (proposals) => intelligenceRepository.writeTopicDiscoveryProposals(proposals),
    writeEvidenceChain: (entries) => intelligenceRepository.writeEvidenceChain(entries),
    readNarrativeDiscoveryRecords: () => intelligenceRepository.readNarrativeDiscoveryRecords(),
    writeNarrativeDiscovery: (report) => intelligenceRepository.writeNarrativeDiscovery(report),
    writeSession: (session) => intakeRepository.writeMergedSession(session),
    resolveTopics: (session, discovery) => resolveTopicsAndRegister(session, topicRegistryRepository, discovery),
    write: (session, bundle) => {
      void session;
      intakeRepository.writeIntakeAgentBundle(bundle);
    },
    validateCandidate: (candidate) => validator.validate('intake_agent_candidate.schema.json', candidate),
    validateVerification: (report) => validator.validate('intake_agent_verification.schema.json', report),
    validateNarrativeDiscovery: (report) => validator.validate('narrative_discovery_report.schema.json', report),
    now: () => new Date().toISOString(),
  });

  const syncWorldMonitorSourcesUseCase = new SyncWorldMonitorSourcesUseCase({
    buildInventory: (input) => worldMonitorSourceRepository.buildInventory(input),
    fetchOperation: (descriptor, mode) => worldMonitorHttpClient.fetchOperation(
      descriptor,
      mode,
      mode === 'sandbox' ? worldMonitorSourceRepository.readSandboxFixture(descriptor) : undefined,
    ),
    seenPayloadHashes: () => worldMonitorSourceRepository.seenPayloadHashes(),
    existingEvidenceIds: () => intakeRepository.existingEvidenceIds(),
    writeInventory: (inventory) => worldMonitorSourceRepository.writeInventory(inventory),
    writeSyncReport: (report) => worldMonitorSourceRepository.writeSyncReport(report),
    readFactState: () => worldMonitorSourceRepository.readFactState(),
    writeFactState: (state) => worldMonitorSourceRepository.writeFactState(state),
    writeIntakeSession: (session) => intakeRepository.writeIntakeSession(session, renderIntakeWorkbench(session)),
    resolveTopics: (session) => {
      // Autonomous resolution: register new provisional topics/branches into
      // the registry first, then rebuild the audit so newly registered topics
      // resolve as existing_topic in the final audit.
      resolveTopicsAndRegister(session, topicRegistryRepository);
    },
    validateInventory: (inventory) => validator.validate('worldmonitor_source_inventory.schema.json', inventory),
    validateReport: (report) => validator.validate('worldmonitor_sync_report.schema.json', report),
    validateFactState: (state) => validator.validate('worldmonitor_fact_state.schema.json', state),
    validateSession: (session) => validator.validate('intake_session.schema.json', session),
    validateCandidate: (candidate) => validator.validate('evidence_candidate.schema.json', candidate),
    now: () => new Date().toISOString(),
    productionConfigured: () => Boolean(worldMonitorApiKey),
  });

  const autonomousResearchRepository = new FileAutonomousResearchRepository(repoRoot);
  const buildResearchBaselineCompletionUseCase = new BuildResearchBaselineCompletionUseCase({
    now: () => new Date().toISOString(),
    producerVersion: () => 'v0.13.5',
    readSnapshot: () => autonomousResearchRepository.readLatestSnapshot(),
    readRegistry: () => topicRegistryRepository.readTopicRegistry(),
    writeReport: (report) => researchBaselineCompletionRepository.writeReport(report),
    validateReport: (report) => validator.validate('research_baseline_completion_report.schema.json', report),
  });
  const runAutonomousResearchUseCase = new RunAutonomousResearchUseCase({
    createRunContext,
    now: () => new Date().toISOString(),
    readPolicy: () => autonomousResearchRepository.readPolicy(),
    readLatestSession: () => {
      try { return intakeRepository.readLatestSession(); } catch { return null; }
    },
    readLatestAgentBundle: () => intakeRepository.readLatestAgentBundle(),
    readTopicAudit: () => topicRegistryRepository.readTopicResolutionAudit(),
    readRegistry: () => topicRegistryRepository.readTopicRegistry(),
    readOperationalEvidence: () => autonomousResearchRepository.readOperationalEvidence(),
    readPreviousOperatorRunId: () => autonomousResearchRepository.readPreviousOperatorRunId(),
    operationalArtifactPaths: (runId) => autonomousResearchRepository.operationalArtifactPaths(runId),
    validateDrafts: ({ drafts, sourceFile, generatedAt }) => validateEvidenceImport({ repoRoot, drafts, sourceFile, generatedAt }),
    normalizeDrafts: ({ drafts, sourceFile, importedAt }) => normalizeEvidenceImport({ drafts, sourceFile, importedAt }),
    writePublishedEvidence: (rows) => autonomousResearchRepository.writePublishedEvidence(rows),
    applyNarrativeGraphPromotions: (report) => topicRegistryRepository.applyNarrativeGraphPromotions(report),
    writeNarrativeGraphPromotion: (report) => autonomousResearchRepository.writeNarrativeGraphPromotion(report),
    readLatestSnapshot: () => autonomousResearchRepository.readLatestSnapshot(),
    writeRun: (result) => autonomousResearchRepository.writeRun(result),
    validatePromotionReport: (report) => validator.validate('autonomous_promotion_report.schema.json', report),
    validateNarrativeGraphPromotion: (report) => validator.validate('narrative_graph_promotion_report.schema.json', report),
    validateSnapshot: (snapshot) => validator.validate('stage_snapshot_history.schema.json', snapshot),
    validateDiff: (diff) => validator.validate('stage_diff.schema.json', diff),
    validateWeeklyBrief: (brief) => validator.validate('weekly_brief.schema.json', brief),
  });
  const validateAutonomousResearchPolicyUseCase = new ValidateAutonomousResearchPolicyUseCase({
    readPolicy: () => autonomousResearchRepository.readPolicy(),
    writeAudit: (audit) => autonomousResearchRepository.writePolicyAudit(audit),
    validateAudit: (audit) => validator.validate('autonomous_research_policy_audit.schema.json', audit),
    now: () => new Date().toISOString(),
    producerVersion: () => 'v0.15.0',
  });

  const researchAgentRepository = new FileResearchAgentRepository(repoRoot);
  const directSourceProvider = new AuthoritativeDirectSourceProvider();
  const runWebResearchUseCase = new RunWebResearchUseCase({
    now: () => new Date().toISOString(),
    producerVersion: () => 'v0.13.5',
    config: () => webSearchConfigFromEnv(process.env),
    readRegistry: () => topicRegistryRepository.readTopicRegistry(),
    search: (input) => webSearchProvider.search(input),
    writeReport: (report) => webResearchRepository.writeReport(report),
    validateReport: (report) => validator.validate('web_research_report.schema.json', report),
  });
  const buildResearchCampaignUseCase = new BuildResearchCampaignUseCase({
    now: () => new Date().toISOString(),
    producerVersion: () => 'v0.13.2',
    readRegistry: () => topicRegistryRepository.readTopicRegistry(),
    readSourceAtlas: () => {
      const atlas = researchCoverageRepository.readSourceAtlas();
      validator.validate('research_source_atlas.schema.json', atlas);
      return atlas;
    },
    readUniverse: () => {
      const universe = researchCoverageRepository.readUniverse();
      validator.validate('research_universe.schema.json', universe);
      return universe;
    },
    readCompanyRegistry: () => {
      const companies = researchCoverageRepository.readCompanyRegistry();
      validator.validate('company_research_registry.schema.json', companies);
      return companies;
    },
    buildBaselineCompletion: () => buildResearchBaselineCompletionUseCase.execute(),
    writeCampaign: (campaign) => researchCoverageRepository.writeCampaign(campaign),
    validateCampaign: (campaign) => validator.validate('research_campaign.schema.json', campaign),
  });
  const runDirectSourceResearchUseCase = new RunDirectSourceResearchUseCase({
    now: () => new Date().toISOString(),
    producerVersion: () => 'v0.13.2',
    readSourceAtlas: () => {
      const atlas = researchCoverageRepository.readSourceAtlas();
      validator.validate('research_source_atlas.schema.json', atlas);
      return atlas;
    },
    supports: (source) => directSourceProvider.supports(source),
    search: (input) => directSourceProvider.search(input),
    writeReport: (report) => researchCoverageRepository.writeDirectResearch(report),
    validateReport: (report) => validator.validate('direct_source_research_report.schema.json', report),
  });
  const prepareDirectSourceIntakeUseCase = new PrepareDirectSourceIntakeUseCase({
    now: () => new Date().toISOString(),
    existingEvidenceIds: () => intakeRepository.existingEvidenceIds(),
    writeIntakeSession: (session) => intakeRepository.writeIntakeSession(session, renderIntakeWorkbench(session)),
    resolveTopics: (session) => resolveTopicsAndRegister(session, topicRegistryRepository),
    validateSession: (session) => validator.validate('intake_session.schema.json', session),
    validateCandidate: (candidate) => validator.validate('evidence_candidate.schema.json', candidate),
  });
  const buildResearchLeadTriageUseCase = new BuildResearchLeadTriageUseCase({
    now: () => new Date().toISOString(),
    producerVersion: () => 'v0.13.3',
    readWebResearch: () => webResearchRepository.readLatestReport(),
    readDirectResearch: () => researchCoverageRepository.readLatestDirectResearch(),
    readSourceAtlas: () => {
      const atlas = researchCoverageRepository.readSourceAtlas();
      validator.validate('research_source_atlas.schema.json', atlas);
      return atlas;
    },
    readCompanies: () => {
      const companies = researchCoverageRepository.readCompanyRegistry();
      validator.validate('company_research_registry.schema.json', companies);
      return companies;
    },
    writeReport: (report) => researchLeadTriageRepository.writeReport(report),
    validateReport: (report) => validator.validate('research_lead_triage_report.schema.json', report),
  });
  const retrieveResearchSourcesUseCase = new RetrieveResearchSourcesUseCase({
    now: () => new Date().toISOString(),
    producerVersion: () => 'v0.13.4',
    readLeadTriage: () => researchLeadTriageRepository.readLatestReport(),
    retrieve: (input) => researchSourceRetriever.retrieve(input),
    writeReport: (report) => researchSourceRetrievalRepository.writeReport(report),
    validateReport: (report) => validator.validate('research_source_retrieval_report.schema.json', report),
    writeQualityReport: (report) => researchSourceRetrievalRepository.writeQualityReport(report),
    validateQualityReport: (report) => validator.validate('research_source_quality_report.schema.json', report),
  });
  const runResearchCampaignUseCase = new RunResearchCampaignUseCase({
    buildCampaign: (input) => buildResearchCampaignUseCase.execute(input),
    runWebResearch: (input) => runWebResearchUseCase.execute(input),
    runDirectSourceResearch: (input) => runDirectSourceResearchUseCase.execute(input),
    prepareDirectSourceIntake: (report) => prepareDirectSourceIntakeUseCase.execute(report),
    buildLeadTriage: () => buildResearchLeadTriageUseCase.execute(),
    retrieveSources: () => retrieveResearchSourcesUseCase.execute({ maxItems: 6 }),
  });
  const researchAgentLoopUseCase = new ResearchAgentLoopUseCase({
    producerVersion: () => 'v0.11.0',
    now: () => new Date().toISOString(),
    runSourceSync: async (input) => syncWorldMonitorSourcesUseCase.execute(input),
    runWebResearch: (input) => runWebResearchUseCase.execute(input),
    runResearchCampaign: (input) => runResearchCampaignUseCase.execute(input),
    runIntakeAgent: () => runIntakeAgentUseCase.executeLatest(),
    runAiShadow: async () => ({ report: (await runAiShadowValidationUseCase.execute()).report as AiShadowValidationReport | null }),
    runLearningCycle: () => buildIntakeLearningCycleUseCase.execute(),
    runValidateTopics: () => validateTopicsUseCase.execute(),
    runAutonomousResearch: (bundle, publish) => runAutonomousResearchUseCase.execute({ bundle, publish }),
    runReview: () => buildOperatorReviewUseCase.execute(),
    readStaleCandidates: () => researchAgentRepository.readStaleCandidates(),
    readQueueItems: () => researchAgentRepository.readQueueItems(),
    discardPurged: (decisions) => researchAgentRepository.discardPurged(decisions),
    readEvolutionLedger: () => researchAgentRepository.readEvolutionLedger(),
    writeEvolutionLedger: (ledger) => researchAgentRepository.writeEvolutionLedger(ledger),
    readLearningMetrics: () => researchAgentRepository.readLearningMetrics(),
    writeRunManifest: (manifest) => researchAgentRepository.writeRunManifest(manifest),
  });
  const researchAgentScheduler = new ResearchAgentScheduler({
    runLoop: async (kind, trigger) => researchAgentLoopUseCase.execute({ loop_kind: kind, triggered_by: trigger }),
    readConfig: () => researchAgentRepository.readSchedulerConfig(),
    writeConfig: (config) => researchAgentRepository.writeSchedulerConfig(config),
    now: () => new Date(),
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
    prepareEvidenceIntakeUseCase,
    applyEvidenceIntakeReviewUseCase,
    retryEvidenceIntakePipelineUseCase,
    evaluateIntakeUseCase,
    buildIntakeLearningProfileUseCase,
    buildIntakeLearningCycleUseCase,
    reviewIntelligenceProposalUseCase,
    validateTopicsUseCase,
    runAiShadowValidationUseCase,
    runAiShadowCorpusEvaluationUseCase,
    runIntakeAgentUseCase,
    syncWorldMonitorSourcesUseCase,
    runWebResearchUseCase,
    webResearchRepository,
    buildResearchCampaignUseCase,
    runDirectSourceResearchUseCase,
    prepareDirectSourceIntakeUseCase,
    runResearchCampaignUseCase,
    buildResearchLeadTriageUseCase,
    researchLeadTriageRepository,
    retrieveResearchSourcesUseCase,
    buildResearchBaselineCompletionUseCase,
    researchBaselineCompletionRepository,
    researchSourceRetrievalRepository,
    runAutonomousResearchUseCase,
    validateAutonomousResearchPolicyUseCase,
    researchAgentLoopUseCase,
    researchAgentScheduler,
    researchAgentRepository,
    validator,
  };
}
