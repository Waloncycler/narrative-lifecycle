import { db } from '@/db/index';
import { evidence, intakeSessions, rawDocuments } from '@/db/schema';
import type { EvidenceIntakeSession, RawDocument } from '@/features/intake/types/intake';
import { IntakeArtifactRepository } from '@/features/intake/io/intake_io';

export class DbIntakeRepository {
  private fallbackRepo: IntakeArtifactRepository;

  constructor(repoRoot: string = process.cwd()) {
    this.fallbackRepo = new IntakeArtifactRepository(repoRoot);
  }

  readRawDocument(input: { file?: string; text?: string }): RawDocument {
    return this.fallbackRepo.readRawDocument(input);
  }

  existingEvidenceIds(): Set<string> {
    return new Set(db.select({ evidence_id: evidence.evidence_id }).from(evidence).all().map((row) => row.evidence_id));
  }

  readEvidenceNodes(): import('@/features/evidence/domain/evidence').EvidenceNode[] {
    return db.select().from(evidence).all().map((row) => ({
      evidence_id: row.evidence_id,
      topic_id: row.topic_id,
      branch_id: row.branch_id,
      event_date: row.event_date,
      available_at: row.available_at,
      event_title: row.event_title,
      event_summary: row.event_summary ?? undefined,
      event_type: row.event_type,
      source_name: row.source_name,
      source_url: row.source_url ?? undefined,
      source_type: row.source_type ?? undefined,
      evidence_strength: row.evidence_strength as import('@/features/evidence/domain/evidence').EvidenceStrength,
      affected_layer: JSON.parse(row.affected_layer_json) as import('@/features/evidence/domain/evidence').EvidenceLayer[],
      stage_effect: row.stage_effect,
      parent_or_branch: row.parent_or_branch as import('@/features/evidence/domain/evidence').EvidenceScope | undefined,
      interpretation: row.interpretation ?? undefined,
      limitation: row.limitation ?? undefined,
      positive_or_negative: row.positive_or_negative as 'positive' | 'negative' | 'neutral' | undefined,
      confidence: row.confidence ?? undefined,
    }));
  }

  writeIntakeSession(session: EvidenceIntakeSession, workbenchHtml: string): void {
    this.fallbackRepo.writeIntakeSession(session, workbenchHtml);
    this.persistSession(session);
  }

  private persistSession(session: EvidenceIntakeSession): void {
    db.transaction((tx) => {
      tx.insert(rawDocuments).values({
        raw_document_id: session.raw_document.raw_document_id,
        source_name: session.raw_document.source_name,
        source_kind: session.raw_document.source_kind,
        ingested_at: session.raw_document.ingested_at,
        text: session.raw_document.text,
        character_count: session.raw_document.character_count,
      }).onConflictDoUpdate({
        target: rawDocuments.raw_document_id,
        set: {
          source_name: session.raw_document.source_name,
          source_kind: session.raw_document.source_kind,
          ingested_at: session.raw_document.ingested_at,
          text: session.raw_document.text,
          character_count: session.raw_document.character_count,
        },
      }).run();

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
      }).onConflictDoUpdate({
        target: intakeSessions.session_id,
        set: {
          generated_at: session.generated_at,
          raw_document_id: session.raw_document.raw_document_id,
          chunks_json: JSON.stringify(session.chunks),
          provenance_records_json: JSON.stringify(session.provenance_records),
          candidates_json: JSON.stringify(session.candidates),
          ai_shadow_candidates_json: JSON.stringify(session.ai_shadow_candidates ?? []),
          candidate_comparisons_json: JSON.stringify(session.candidate_comparisons ?? []),
          review_template_json: JSON.stringify(session.review_template),
        },
      }).run();
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
    const session = db.select().from(intakeSessions).orderBy(intakeSessions.generated_at).all().at(-1);
    if (!session) return this.fallbackRepo.readLatestSession();
    // Drizzle's SQLite relation helper is intentionally avoided here: this is
    // a tiny, auditable reconstruction of a persisted Intake session.
    const raw = db.select().from(rawDocuments).all().find((item) => item.raw_document_id === session.raw_document_id);
    if (!raw) return this.fallbackRepo.readLatestSession();
    return {
      session_id: session.session_id,
      generated_at: session.generated_at,
      raw_document: {
        raw_document_id: raw.raw_document_id,
        source_name: raw.source_name,
        source_kind: raw.source_kind as RawDocument['source_kind'],
        ingested_at: raw.ingested_at,
        text: raw.text,
        character_count: raw.character_count,
      },
      chunks: JSON.parse(session.chunks_json ?? '[]'),
      provenance_records: JSON.parse(session.provenance_records_json ?? '[]'),
      candidates: JSON.parse(session.candidates_json ?? '[]'),
      ai_shadow_candidates: JSON.parse(session.ai_shadow_candidates_json ?? '[]'),
      candidate_comparisons: JSON.parse(session.candidate_comparisons_json ?? '[]'),
      review_template: JSON.parse(session.review_template_json ?? '[]'),
    };
  }

  readLatestAgentBundle(): import('@/features/intake/types/intake_agent').IntakeAgentReviewBundle | null {
    return this.fallbackRepo.readLatestAgentBundle();
  }

  writeMergedSession(session: EvidenceIntakeSession): void {
    this.fallbackRepo.writeMergedSession(session);
    // The Agent writes Topic/Branch enrichment into the merged session. The
    // database is the operational read model, so a file-only write silently
    // discarded every mapping on the next use-case boundary.
    this.persistSession(session);
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
