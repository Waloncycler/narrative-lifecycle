import type { EvidenceImportDraft } from '../../types/evidence_import';

export interface ImportEvidenceUseCaseDeps {
  loadDraft(file: string): EvidenceImportDraft[];
  readDraftSource(file: string): string;
  validate(input: { drafts: EvidenceImportDraft[]; sourceFile: string }): { status: 'passed' | 'failed' };
  normalize(input: { drafts: EvidenceImportDraft[]; sourceFile: string }): unknown[];
  writeValidationReport(report: unknown): void;
  writeAcceptedImport(report: unknown, normalized: unknown[]): unknown;
  writeRejectedImport(report: unknown, sourceBody: string): unknown;
}

export class ImportEvidenceUseCase {
  constructor(private readonly deps: ImportEvidenceUseCaseDeps) {}

  validate(file: string): unknown {
    const drafts = this.deps.loadDraft(file);
    const report = this.deps.validate({ drafts, sourceFile: file });
    this.deps.writeValidationReport(report);
    return report;
  }

  import(file: string): { report: unknown; failed: boolean } {
    const drafts = this.deps.loadDraft(file);
    const validation = this.deps.validate({ drafts, sourceFile: file });
    this.deps.writeValidationReport(validation);

    if (validation.status === 'failed') {
      return { report: this.deps.writeRejectedImport(validation, this.deps.readDraftSource(file)), failed: true };
    }

    const normalized = this.deps.normalize({ drafts, sourceFile: file });
    return { report: this.deps.writeAcceptedImport(validation, normalized), failed: false };
  }
}
