import { db } from '@/db/index';
import { intakeSessions, rawDocuments } from '@/db/schema';
import type { EvidenceIntakeSession, RawDocument } from '@/features/intake/types/intake';
import { IntakeArtifactRepository } from '@/features/intake/io/intake_io';

export class DbIntakeRepository {
  private fallbackRepo: IntakeArtifactRepository;

  constructor(repoRoot: string = process.cwd()) {
    this.fallbackRepo = new IntakeArtifactRepository();
  }

  // Keep existing methods routing to fallback except for core writes
  // In a real migration we'd implement all reads/writes.
  readRawDocument(input: { file?: string; text?: string }): RawDocument {
    return this.fallbackRepo.readRawDocument(input);
  }

  existingEvidenceIds(): Set<string> {
    return this.fallbackRepo.existingEvidenceIds();
  }

  readEvidenceNodes(): import('@/features/evidence/domain/evidence').EvidenceNode[] {
    return this.fallbackRepo.readEvidenceNodes();
  }

  writeIntakeSession(session: EvidenceIntakeSession, workbenchHtml: string): void {
    this.fallbackRepo.writeIntakeSession(session, workbenchHtml);

    db.transaction((tx) => {
      tx.insert(rawDocuments).values({
        raw_document_id: session.raw_document.raw_document_id,
        source_name: session.raw_document.source_name,
        source_kind: session.raw_document.source_kind,
        ingested_at: session.raw_document.ingested_at,
        text: session.raw_document.text,
        character_count: session.raw_document.character_count,
      }).onConflictDoNothing().run();

      tx.insert(intakeSessions).values({
        session_id: session.session_id,
        generated_at: session.generated_at,
        raw_document_id: session.raw_document.raw_document_id,
        chunks_json: JSON.stringify(session.chunks),
        provenance_records_json: JSON.stringify(session.provenance_records),
        candidates_json: JSON.stringify(session.candidates),
        ai_shadow_candidates_json: JSON.stringify(session.ai_shadow_candidates ?? []),
        candidate_comparisons_json: JSON.stringify(session.candidate_comparisons ?? []),
        review_template_json: JSON.stringify(session.review_template),
      }).onConflictDoNothing().run();
    });
  }

  writeAiShadowResult(session: EvidenceIntakeSession, audit: unknown): void {
    this.fallbackRepo.writeAiShadowResult(session, audit);
    // Overwrite json fields if needed
  }

  writeAiShadowValidationReport(report: any): void {
    this.fallbackRepo.writeAiShadowValidationReport(report);
  }

  writeAiShadowCorpusReport(report: any): void {
    this.fallbackRepo.writeAiShadowCorpusReport(report);
  }

  writeIntakeAgentBundle(bundle: import('@/features/intake/types/intake_agent').IntakeAgentReviewBundle): void {
    this.fallbackRepo.writeIntakeAgentBundle(bundle);
  }

  readLatestSession(): EvidenceIntakeSession {
    return this.fallbackRepo.readLatestSession();
  }

  readLatestAgentBundle(): import('@/features/intake/types/intake_agent').IntakeAgentReviewBundle | null {
    return this.fallbackRepo.readLatestAgentBundle();
  }

  writeMergedSession(session: EvidenceIntakeSession): void {
    this.fallbackRepo.writeMergedSession(session);
  }

  readLearningProfile(): import('@/features/intake/types/intake_learning').IntakeLearningProfile | null {
    return this.fallbackRepo.readLearningProfile();
  }

  writeLearningProfile(profile: import('@/features/intake/types/intake_learning').IntakeLearningProfile): void {
    this.fallbackRepo.writeLearningProfile(profile);
  }

  readPreviousLearningProfile(currentProfileId: string): import('@/features/intake/types/intake_learning').IntakeLearningProfile | null {
    return this.fallbackRepo.readPreviousLearningProfile(currentProfileId);
  }

  readAiShadowValidationReport(): any | null {
    return this.fallbackRepo.readAiShadowValidationReport();
  }

  writeLearningCycle(cycle: import('@/features/intake/types/intake_learning_cycle').IntakeLearningCycle): void {
    this.fallbackRepo.writeLearningCycle(cycle);
  }

  readReviewDecisions(file?: string): import('@/features/intake/types/intake').ReviewDecision[] {
    return this.fallbackRepo.readReviewDecisions(file);
  }

  readApplyResult(): import('@/features/intake/types/intake').EvidenceIntakeApplyResult | null {
    return this.fallbackRepo.readApplyResult();
  }

  readLatestEvaluation(): import('@/features/intake/types/intake').IntakeEvaluationReport {
    return this.fallbackRepo.readLatestEvaluation();
  }

  writeEvidenceDraft(drafts: import('@/features/evidence/types/evidence_import').EvidenceImportDraft[]): string {
    return this.fallbackRepo.writeEvidenceDraft(drafts);
  }

  writeApplyResult(result: import('@/features/intake/types/intake').EvidenceIntakeApplyResult): void {
    this.fallbackRepo.writeApplyResult(result);
  }

  writeIntakeEvaluation(report: import('@/features/intake/types/intake').IntakeEvaluationReport): void {
    this.fallbackRepo.writeIntakeEvaluation(report);
  }

  readStageChangeSummary(): unknown {
    return this.fallbackRepo.readStageChangeSummary();
  }
}
