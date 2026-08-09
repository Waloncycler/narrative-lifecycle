import { buildHistoricalEvidenceRecovery } from '@/features/research/domain/historical_evidence_recovery';
import type { HistoricalEvidenceRecoveryReport } from '@/features/research/types/historical_evidence_recovery';
import type { TopicEvolutionTimeline } from '@/features/stages/domain/stage_evolution_reconstructor';

export interface BuildHistoricalEvidenceRecoveryUseCaseDeps {
  now(): string;
  producerVersion(): string;
  readTimelines(): TopicEvolutionTimeline[] | null;
  writeReport(report: HistoricalEvidenceRecoveryReport): void;
  validateReport(report: HistoricalEvidenceRecoveryReport): void;
}

export class BuildHistoricalEvidenceRecoveryUseCase {
  constructor(private readonly deps: BuildHistoricalEvidenceRecoveryUseCaseDeps) {}

  execute(): HistoricalEvidenceRecoveryReport {
    const report = buildHistoricalEvidenceRecovery({ timelines: this.deps.readTimelines() ?? [], generatedAt: this.deps.now(), producerVersion: this.deps.producerVersion() });
    this.deps.validateReport(report);
    this.deps.writeReport(report);
    return report;
  }
}
