import type { BaselineEvidenceReconciliationReport } from '@/features/research/types/baseline_evidence_reconciliation';

export interface AdmitBaselineEvidenceUseCaseDeps {
  reconcile(): BaselineEvidenceReconciliationReport;
  appendAdmission(input: { report: BaselineEvidenceReconciliationReport; topicId: string; reviewer: string; admittedAt: string }): string;
  now(): string;
}

export class AdmitBaselineEvidenceUseCase {
  constructor(private readonly deps: AdmitBaselineEvidenceUseCaseDeps) {}

  execute(input: { topicId: string; reviewer: string }): { admission_id: string; report: BaselineEvidenceReconciliationReport } {
    const topicId = input.topicId.trim();
    if (!topicId) throw new Error('baseline_topic_id_is_required');
    const report = this.deps.reconcile();
    const admissionId = this.deps.appendAdmission({ report, topicId, reviewer: input.reviewer, admittedAt: this.deps.now() });
    return { admission_id: admissionId, report };
  }
}
