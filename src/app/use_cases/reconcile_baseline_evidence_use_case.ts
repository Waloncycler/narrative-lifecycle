import { buildBaselineEvidenceReconciliation } from '@/features/research/domain/baseline_evidence_reconciliation';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { BaselineEvidenceReconciliationReport } from '@/features/research/types/baseline_evidence_reconciliation';

export interface ReconcileBaselineEvidenceUseCaseDeps {
  now(): string;
  producerVersion(): string;
  readRegistry(): TopicRegistry;
  readEvidence(): EvidenceNode[];
  readAdmittedEvidenceIds(): Set<string>;
  write(report: BaselineEvidenceReconciliationReport): void;
  validate(report: BaselineEvidenceReconciliationReport): void;
}

export class ReconcileBaselineEvidenceUseCase {
  constructor(private readonly deps: ReconcileBaselineEvidenceUseCaseDeps) {}

  execute(): BaselineEvidenceReconciliationReport {
    const report = buildBaselineEvidenceReconciliation({
      registry: this.deps.readRegistry(),
      evidence: this.deps.readEvidence(),
      admittedEvidenceIds: this.deps.readAdmittedEvidenceIds(),
      generatedAt: this.deps.now(),
      producerVersion: this.deps.producerVersion(),
    });
    this.deps.validate(report);
    this.deps.write(report);
    return report;
  }
}
