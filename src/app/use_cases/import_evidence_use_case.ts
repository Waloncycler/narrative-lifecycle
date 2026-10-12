import type { EvidenceImportDraft, EvidenceImportReport, EvidenceValidationReport } from '@/features/evidence/types/evidence_import';

export interface ImportEvidenceUseCaseDeps {
  loadDraft(file: string): EvidenceImportDraft[];
  readDraftSource(file: string): string;
  validate(input: { drafts: EvidenceImportDraft[]; sourceFile: string }): EvidenceValidationReport;
  normalize(input: { drafts: EvidenceImportDraft[]; sourceFile: string }): unknown[];
  writeValidationReport(report: EvidenceValidationReport): void;
  writeAcceptedImport(report: EvidenceValidationReport, normalized: unknown[]): EvidenceImportReport;
  writeRejectedImport(report: EvidenceValidationReport, sourceBody: string): EvidenceImportReport;
  isIdempotentDuplicate?(input: { drafts: EvidenceImportDraft[]; sourceFile: string }): boolean;
}

export class ImportEvidenceUseCase {
  constructor(private readonly deps: ImportEvidenceUseCaseDeps) {}

  validate(file: string): EvidenceValidationReport {
    const drafts = this.deps.loadDraft(file);
    const report = this.toIdempotentPass(
      this.deps.validate({ drafts, sourceFile: file }),
      drafts,
      file,
    );
    this.deps.writeValidationReport(report);
    return report;
  }

  import(file: string): { report: EvidenceImportReport; failed: boolean } {
    const drafts = this.deps.loadDraft(file);
    const validation = this.toIdempotentPass(
      this.deps.validate({ drafts, sourceFile: file }),
      drafts,
      file,
    );
    this.deps.writeValidationReport(validation);

    if (validation.status === 'failed' && !this.deps.isIdempotentDuplicate?.({ drafts, sourceFile: file })) {
      return { report: this.deps.writeRejectedImport(validation, this.deps.readDraftSource(file)), failed: true };
    }

    const normalized = this.deps.normalize({ drafts, sourceFile: file });
    return { report: this.deps.writeAcceptedImport(validation, normalized), failed: false };
  }

  private toIdempotentPass(
    report: EvidenceValidationReport,
    drafts: EvidenceImportDraft[],
    sourceFile: string,
  ): EvidenceValidationReport {
    if (report.status === 'passed' || !this.deps.isIdempotentDuplicate?.({ drafts, sourceFile })) {
      return report;
    }

    return {
      ...report,
      status: 'passed',
      accepted_count: drafts.length,
      rejected_count: 0,
      errors: [],
      accepted_evidence_ids: drafts.map((draft) => draft.evidence_id),
      rejected_evidence_ids: [],
      warnings: [
        ...report.warnings,
        ...drafts.map((draft) => ({
          evidence_id: draft.evidence_id,
          message: 'Exact normalized duplicate accepted as an idempotent no-op.',
        })),
      ],
    };
  }
}
