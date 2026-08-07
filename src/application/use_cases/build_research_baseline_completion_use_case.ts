import { buildResearchBaselineCompletion } from '../../domain/research_baseline_completion';
import type { StageSnapshotHistory } from '../../types/diff';
import type { TopicRegistry } from '../../types/topic_resolution';
import type { ResearchBaselineCompletionReport } from '../../types/research_baseline_completion';

export interface BuildResearchBaselineCompletionUseCaseDeps {
  now(): string;
  producerVersion(): string;
  readSnapshot(): StageSnapshotHistory | null;
  readRegistry(): TopicRegistry;
  writeReport(report: ResearchBaselineCompletionReport): void;
  validateReport(report: ResearchBaselineCompletionReport): void;
}

export class BuildResearchBaselineCompletionUseCase {
  constructor(private readonly deps: BuildResearchBaselineCompletionUseCaseDeps) {}

  execute(): ResearchBaselineCompletionReport {
    const report = buildResearchBaselineCompletion({ snapshot: this.deps.readSnapshot(), registry: this.deps.readRegistry(), generatedAt: this.deps.now(), producerVersion: this.deps.producerVersion() });
    this.deps.validateReport(report);
    this.deps.writeReport(report);
    return report;
  }
}
