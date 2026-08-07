import {
  applyResolvedTopics,
  chunkRawDocument,
  evidenceDraftsFromDecisions,
  extractEvidenceCandidates,
  noTradingAdvice,
  reviewTemplate,
} from '../../domain/intake_rules';
import { buildIntakeEvaluation } from '../../domain/intake_evaluation';
import { buildTopicResolutionAudit } from '../../domain/topic_resolver';
import type { EvidenceImportDraft, EvidenceImportReport } from '../../types/evidence_import';
import type { AiCandidateSuggestion, EvidenceIntakeApplyResult, EvidenceIntakeSession, IntakeEvaluationReport, RawDocument, ReviewDecision } from '../../types/intake';
import type { RunManifest } from '../../types/run_context';
import type { TopicRegistry, TopicResolutionAudit, TopicRegistryValidationReport } from '../../types/topic_resolution';
import { compareRuleAndAiCandidates } from '../../domain/intake_evaluation';
import { buildAiShadowValidationReport } from '../../domain/ai_shadow_validation';
import { buildIntakeLearningProfile } from '../../domain/intake_learning';
import type { IntakeLearningProfile } from '../../types/intake_learning';
import { buildIntakeLearningCycle } from '../../domain/intake_learning_cycle';
import type { IntakeLearningCycle } from '../../types/intake_learning_cycle';

export interface PrepareEvidenceIntakeUseCaseDeps {
  readRawDocument(input: { file?: string; text?: string }): RawDocument;
  existingEvidenceIds(): Set<string>;
  writeIntakeSession(session: EvidenceIntakeSession, workbenchHtml: string): void;
  renderWorkbench(session: EvidenceIntakeSession): string;
  generateAiCandidates?: (input: { session: EvidenceIntakeSession }) => AiCandidateSuggestion[];
  now(): string;
}

export class PrepareEvidenceIntakeUseCase {
  constructor(private readonly deps: PrepareEvidenceIntakeUseCaseDeps) {}

  execute(input: { file?: string; text?: string }): EvidenceIntakeSession {
    const generatedAt = this.deps.now();
    const rawDocument = this.deps.readRawDocument(input);
    const chunks = chunkRawDocument(rawDocument);
    const { candidates, provenance } = extractEvidenceCandidates({
      rawDocument,
      chunks,
      existingEvidenceIds: this.deps.existingEvidenceIds(),
      generatedAt,
    });
    const session: EvidenceIntakeSession = {
      session_id: `intake_${generatedAt.slice(0, 10).replaceAll('-', '')}_${rawDocument.raw_document_id}`,
      generated_at: generatedAt,
      raw_document: rawDocument,
      chunks,
      provenance_records: provenance,
      candidates,
      review_template: reviewTemplate(candidates),
    };
    const aiShadowCandidates = this.deps.generateAiCandidates?.({ session }) ?? [];
    session.ai_shadow_candidates = aiShadowCandidates;
    session.candidate_comparisons = compareRuleAndAiCandidates({ ruleCandidates: candidates, aiCandidates: aiShadowCandidates });
    this.deps.writeIntakeSession(session, this.deps.renderWorkbench(session));
    return session;
  }
}

export interface ApplyEvidenceIntakeReviewUseCaseDeps {
  readLatestSession(): EvidenceIntakeSession;
  readTopicResolutionAudit(): TopicResolutionAudit | null;
  readReviewDecisions(file?: string): ReviewDecision[];
  existingEvidenceIds(): Set<string>;
  writeEvidenceDraft(drafts: EvidenceImportDraft[]): string;
  writeApplyResult(result: EvidenceIntakeApplyResult): void;
  importEvidence(file: string): { report: EvidenceImportReport; failed: boolean };
  runWeekly(): RunManifest;
  readStageChangeSummary(): unknown;
  now(): string;
}

export class ApplyEvidenceIntakeReviewUseCase {
  constructor(private readonly deps: ApplyEvidenceIntakeReviewUseCaseDeps) {}

  execute(input: { decisionsFile?: string }): EvidenceIntakeApplyResult {
    const session = this.deps.readLatestSession();
    // Autonomous apply: when no review decisions exist, auto-accept every
    // candidate through the template so the pipeline never waits on humans.
    let decisions: ReviewDecision[];
    try {
      decisions = this.deps.readReviewDecisions(input.decisionsFile);
    } catch {
      decisions = reviewTemplate(session.candidates);
    }
    if (!decisions.length) decisions = reviewTemplate(session.candidates);
    const topicAudit = this.deps.readTopicResolutionAudit();
    if (!topicAudit) throw new Error(`topic resolution audit is required for session ${session.session_id}`);
    assertSameSession('topic resolution audit', session.session_id, topicAudit?.session_id ?? null);
    // Autonomous apply: unresolved / newly-registered topics import as-is
    // instead of blocking the pipeline; the topic registry auto-registers
    // new provisional topics and branches during resolution.
    const review = evidenceDraftsFromDecisions({
      candidates: session.candidates,
      decisions,
      existingEvidenceIds: this.deps.existingEvidenceIds(),
    });
    // Autonomous apply: rewrite each accepted draft's topic from the topic
    // resolution audit so evidence never lands under "unknown_topic". New
    // provisional topics / branches were already registered during resolution.
    applyResolvedTopics(review.drafts, session.candidates, topicAudit);
    const draftPath = review.drafts.length ? this.deps.writeEvidenceDraft(review.drafts) : null;
    const rejectedCount = decisions.filter((decision) => decision.decision === 'reject').length;
    const base = {
      session_id: session.session_id,
      topic_audit_id: topicAudit.audit_id,
      generated_at: this.deps.now(),
      accepted_count: review.drafts.length,
      modified_count: review.modified_count,
      split_count: review.split_count,
      rejected_count: rejectedCount,
      duplicate_count: review.duplicates.length,
      accepted_evidence_ids: review.drafts.map((draft) => draft.evidence_id),
      evidence_draft_path: draftPath,
      pipeline_retry_count: 0,
      pipeline_error: null,
      guardrail_check: {
        human_review_required: false,
        no_trading_advice: noTradingAdvice(review.drafts),
        duplicate_detection_applied: true,
        parent_branch_guardrail_applied: true,
      },
    };

    if (!review.drafts.length || !draftPath) {
      const result: EvidenceIntakeApplyResult = {
        ...base,
        imported: false,
        import_status: review.duplicates.length ? 'duplicates_rejected' : 'no_accepted_evidence',
        import_id: null,
        weekly_run_id: null,
        stage_change_summary: null,
      };
      this.deps.writeApplyResult(result);
      return result;
    }

    if (!base.guardrail_check.no_trading_advice) {
      const result: EvidenceIntakeApplyResult = {
        ...base,
        imported: false,
        import_status: 'failed_no_trading_advice',
        import_id: null,
        weekly_run_id: null,
        stage_change_summary: null,
      };
      this.deps.writeApplyResult(result);
      return result;
    }

    const imported = this.deps.importEvidence(draftPath);
    if (imported.failed) {
      const result: EvidenceIntakeApplyResult = {
        ...base,
        imported: false,
        import_status: imported.report.status,
        import_id: imported.report.import_id,
        weekly_run_id: null,
        stage_change_summary: null,
      };
      this.deps.writeApplyResult(result);
      return result;
    }

    let manifest: RunManifest;
    try {
      manifest = this.deps.runWeekly();
    } catch (error) {
      const result: EvidenceIntakeApplyResult = {
        ...base,
        imported: true,
        import_status: 'imported_pipeline_failed',
        import_id: imported.report.import_id,
        weekly_run_id: null,
        stage_change_summary: null,
        pipeline_error: safeErrorMessage(error),
      };
      this.deps.writeApplyResult(result);
      return result;
    }
    const result: EvidenceIntakeApplyResult = {
      ...base,
      imported: true,
      import_status: imported.report.status,
      import_id: imported.report.import_id,
      weekly_run_id: manifest.run_id,
      stage_change_summary: this.deps.readStageChangeSummary(),
    };
    this.deps.writeApplyResult(result);
    return result;
  }
}

export interface RetryEvidenceIntakePipelineUseCaseDeps {
  readLatestSession(): EvidenceIntakeSession;
  readApplyResult(): EvidenceIntakeApplyResult | null;
  writeApplyResult(result: EvidenceIntakeApplyResult): void;
  runWeekly(): RunManifest;
  readStageChangeSummary(): unknown;
  now(): string;
}

export class RetryEvidenceIntakePipelineUseCase {
  constructor(private readonly deps: RetryEvidenceIntakePipelineUseCaseDeps) {}

  execute(input: { sessionId: string }): EvidenceIntakeApplyResult {
    const session = this.deps.readLatestSession();
    assertSameSession('pipeline retry request', session.session_id, input.sessionId);
    const previous = this.deps.readApplyResult();
    if (!previous) throw new Error(`pipeline retry requires an Apply result for session ${session.session_id}`);
    assertSameSession('pipeline retry Apply result', session.session_id, previous.session_id);
    if (!previous.imported || previous.import_status !== 'imported_pipeline_failed' || previous.weekly_run_id) {
      throw new Error('pipeline retry is only allowed after Evidence import succeeded and Weekly failed');
    }

    const retryCount = (previous.pipeline_retry_count ?? 0) + 1;
    try {
      const manifest = this.deps.runWeekly();
      const result: EvidenceIntakeApplyResult = {
        ...previous,
        generated_at: this.deps.now(),
        import_status: 'imported_pipeline_recovered',
        weekly_run_id: manifest.run_id,
        stage_change_summary: this.deps.readStageChangeSummary(),
        pipeline_retry_count: retryCount,
        pipeline_error: null,
      };
      this.deps.writeApplyResult(result);
      return result;
    } catch (error) {
      const result: EvidenceIntakeApplyResult = {
        ...previous,
        generated_at: this.deps.now(),
        pipeline_retry_count: retryCount,
        pipeline_error: safeErrorMessage(error),
      };
      this.deps.writeApplyResult(result);
      return result;
    }
  }
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(api[_-]?key|authorization|token|secret)\s*[=:]\s*\S+/gi, '$1=[redacted]').slice(0, 500);
}

export interface EvaluateIntakeUseCaseDeps {
  readLatestSession(): EvidenceIntakeSession;
  readReviewDecisions(file?: string): ReviewDecision[];
  readApplyResult(): EvidenceIntakeApplyResult | null;
  readTopicResolutionAudit(): TopicResolutionAudit | null;
  writeIntakeEvaluation(report: IntakeEvaluationReport): void;
  validateEvaluation(report: IntakeEvaluationReport): void;
  now(): string;
}

export class EvaluateIntakeUseCase {
  constructor(private readonly deps: EvaluateIntakeUseCaseDeps) {}

  execute(input: { decisionsFile?: string }): IntakeEvaluationReport {
    const session = this.deps.readLatestSession();
    const applyResult = this.deps.readApplyResult();
    const topicAudit = this.deps.readTopicResolutionAudit();
    assertSameSession('apply result', session.session_id, applyResult?.session_id ?? null);
    assertSameSession('topic resolution audit', session.session_id, topicAudit?.session_id ?? null);
    const report = buildIntakeEvaluation({
      session,
      decisions: this.deps.readReviewDecisions(input.decisionsFile),
      applyResult,
      topicAudit,
      generatedAt: this.deps.now(),
    });
    this.deps.validateEvaluation(report);
    this.deps.writeIntakeEvaluation(report);
    return report;
  }
}

export interface BuildIntakeLearningProfileUseCaseDeps {
  readLatestSession(): EvidenceIntakeSession;
  readReviewDecisions(file?: string): ReviewDecision[];
  readLatestEvaluation(): IntakeEvaluationReport;
  readLearningProfile(): IntakeLearningProfile | null;
  writeLearningProfile(profile: IntakeLearningProfile): void;
  validateProfile(profile: IntakeLearningProfile): void;
  now(): string;
}

export class BuildIntakeLearningProfileUseCase {
  constructor(private readonly deps: BuildIntakeLearningProfileUseCaseDeps) {}

  execute(input: { decisionsFile?: string }): IntakeLearningProfile {
    const session = this.deps.readLatestSession();
    const evaluation = this.deps.readLatestEvaluation();
    assertSameSession('intake evaluation', session.session_id, evaluation.session_id);
    const profile = buildIntakeLearningProfile({
      session,
      decisions: this.deps.readReviewDecisions(input.decisionsFile),
      evaluation,
      previous: this.deps.readLearningProfile(),
      generatedAt: this.deps.now(),
    });
    this.deps.validateProfile(profile);
    this.deps.writeLearningProfile(profile);
    return profile;
  }
}

export interface BuildIntakeLearningCycleUseCaseDeps {
  readLatestSession(): EvidenceIntakeSession;
  readLatestEvaluation(): IntakeEvaluationReport;
  readLearningProfile(): IntakeLearningProfile | null;
  readPreviousLearningProfile(currentProfileId: string): IntakeLearningProfile | null;
  readTopicResolutionAudit(): TopicResolutionAudit | null;
  readAiShadowValidationReport(): import('../../types/intake').AiShadowValidationReport | null;
  writeLearningCycle(cycle: IntakeLearningCycle): void;
  validateCycle(cycle: IntakeLearningCycle): void;
  now(): string;
}

export class BuildIntakeLearningCycleUseCase {
  constructor(private readonly deps: BuildIntakeLearningCycleUseCaseDeps) {}

  execute(): IntakeLearningCycle {
    const profile = this.deps.readLearningProfile();
    if (!profile) throw new Error('learning cycle requires an intake learning profile');
    const session = this.deps.readLatestSession();
    const evaluation = this.deps.readLatestEvaluation();
    const topicAudit = this.deps.readTopicResolutionAudit();
    assertSameSession('intake evaluation', session.session_id, evaluation.session_id);
    assertSameSession('topic resolution audit', session.session_id, topicAudit?.session_id ?? null);
    const cycle = buildIntakeLearningCycle({
      profile,
      previousProfile: this.deps.readPreviousLearningProfile(profile.profile_id),
      session,
      evaluation,
      topicAudit,
      shadowReport: this.deps.readAiShadowValidationReport(),
      generatedAt: this.deps.now(),
    });
    this.deps.validateCycle(cycle);
    this.deps.writeLearningCycle(cycle);
    return cycle;
  }
}

export interface ValidateTopicsUseCaseDeps {
  readLatestSession(): EvidenceIntakeSession | null;
  readTopicRegistry(): TopicRegistry;
  writeTopicResolutionAudit(audit: TopicResolutionAudit): void;
  validateTopicAudit(audit: TopicResolutionAudit): void;
  validateRegistryReport(report: TopicRegistryValidationReport): void;
  now(): string;
}

export class ValidateTopicsUseCase {
  constructor(private readonly deps: ValidateTopicsUseCaseDeps) {}

  execute(): TopicResolutionAudit {
    const session = this.deps.readLatestSession();
    const audit = buildTopicResolutionAudit({
      sessionId: session?.session_id ?? null,
      candidates: session?.candidates ?? [],
      registry: this.deps.readTopicRegistry(),
      generatedAt: this.deps.now(),
    });
    this.deps.validateRegistryReport(audit.registry_validation);
    this.deps.validateTopicAudit(audit);
    this.deps.writeTopicResolutionAudit(audit);
    return audit;
  }
}

export interface RunAiShadowValidationUseCaseDeps {
  readLatestSession(): EvidenceIntakeSession;
  generateAiShadow(session: EvidenceIntakeSession): Promise<{ candidates: AiCandidateSuggestion[]; audit: unknown }>;
  writeAiShadowResult(session: EvidenceIntakeSession, audit: unknown): void;
  validateCandidate(candidate: unknown): void;
  writeAiShadowValidationReport(report: unknown): void;
  now(): string;
}

export class RunAiShadowValidationUseCase {
  constructor(private readonly deps: RunAiShadowValidationUseCaseDeps) {}

  async execute(): Promise<{ session: EvidenceIntakeSession; audit: unknown; report: unknown }> {
    const session = this.deps.readLatestSession();
    const result = await this.deps.generateAiShadow(session);
    for (const candidate of result.candidates) {
      this.deps.validateCandidate(candidateToEvidenceCandidate(candidate, session));
    }
    session.ai_shadow_candidates = result.candidates;
    session.candidate_comparisons = compareRuleAndAiCandidates({ ruleCandidates: session.candidates, aiCandidates: result.candidates });
    const report = buildAiShadowValidationReport({
      generatedAt: this.deps.now(),
      documentCount: 1,
      sessions: [session],
    });
    this.deps.writeAiShadowResult(session, result.audit);
    this.deps.writeAiShadowValidationReport(report);
    return { session, audit: result.audit, report };
  }
}

export interface RunAiShadowCorpusEvaluationUseCaseDeps {
  listPilotDocuments(): Array<{ document_id: string; path: string }>;
  prepareDocument(file: string): EvidenceIntakeSession;
  runAiShadow(): Promise<EvidenceIntakeSession>;
  writeCorpusReport(report: unknown): void;
  now(): string;
}

export class RunAiShadowCorpusEvaluationUseCase {
  constructor(private readonly deps: RunAiShadowCorpusEvaluationUseCaseDeps) {}

  async execute(): Promise<unknown> {
    const documents = this.deps.listPilotDocuments();
    const sessions: EvidenceIntakeSession[] = [];
    for (const document of documents) {
      this.deps.prepareDocument(document.path);
      sessions.push(await this.deps.runAiShadow());
    }
    const report = buildAiShadowValidationReport({
      generatedAt: this.deps.now(),
      documentCount: documents.length,
      sessions,
    });
    this.deps.writeCorpusReport(report);
    return report;
  }
}

function candidateToEvidenceCandidate(candidate: AiCandidateSuggestion, session: EvidenceIntakeSession): unknown {
  const rule = session.candidates.find((item) => item.candidate_id === candidate.candidate_id);
  return {
    candidate_id: candidate.candidate_id,
    raw_document_id: rule?.raw_document_id ?? session.raw_document.raw_document_id,
    chunk_id: rule?.chunk_id ?? session.chunks[0]?.chunk_id ?? 'unknown_chunk',
    provenance_id: rule?.provenance_id ?? session.provenance_records[0]?.provenance_id ?? 'unknown_provenance',
    original_quote: candidate.original_quote,
    suggested_evidence: candidate.suggested_evidence,
    suggested_reason: candidate.suggested_reason,
    uncertainty_notes: candidate.uncertainty_notes,
    field_explanations: rule?.field_explanations ?? {},
    e_strength_rationale: rule?.e_strength_rationale ?? 'AI shadow candidate; human review required.',
    guardrail_check: {
      no_trading_advice: true,
      provenance_present: true,
      human_review_required: false,
    },
  };
}

function assertSameSession(label: string, expected: string, actual: string | null): void {
  if (actual !== null && actual !== expected) {
    throw new Error(`${label} session mismatch: expected ${expected}, received ${actual}`);
  }
}
