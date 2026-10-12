import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { IntakeAgentReviewBundle } from '@/features/intake/types/intake_agent';
import type { AutonomousResearchRun } from '@/features/research/types/autonomous_research';
import type { BaselineEvidenceReconciliationReport } from '@/features/research/types/baseline_evidence_reconciliation';
import type { HistoricalProvenanceRecoveryReport } from '@/features/research/types/historical_provenance_recovery';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';

type RecoveryResult = { report: HistoricalProvenanceRecoveryReport; retrieval: ResearchSourceRetrievalReport };

export interface VerifyBaselineEvidenceUseCaseDeps {
  reconcile(): BaselineEvidenceReconciliationReport;
  recover(input: { evidenceIds: string[]; maxTargets: number; maxSourcesPerTarget: number; includeEvidenceGrade: boolean; requireTopicTitleMatch: boolean }): Promise<RecoveryResult>;
  appendRetrievedSourceIntake(report: ResearchSourceRetrievalReport): EvidenceIntakeSession | null;
  runIntakeAgent(): Promise<IntakeAgentReviewBundle>;
  runAiShadow(): Promise<unknown>;
  runAutonomousResearch(bundle: IntakeAgentReviewBundle, publish: boolean): AutonomousResearchRun;
}

/**
 * Re-validates a bounded set of already-reconciled parent baseline records.
 * It is deliberately not an admission path: the only possible mutation is a
 * normal policy-governed publication request after every existing gate runs.
 */
export class VerifyBaselineEvidenceUseCase {
  constructor(private readonly deps: VerifyBaselineEvidenceUseCaseDeps) {}

  async execute(input: { topicIds?: string[]; maxTopics?: number; maxEvidence?: number; maxSources?: number; publish?: boolean } = {}): Promise<{
    baseline: BaselineEvidenceReconciliationReport;
    selectedTopicIds: string[];
    requestedEvidenceIds: string[];
    recovered: RecoveryResult;
    session: EvidenceIntakeSession | null;
    autonomy: { published: number; held: number } | null;
  }> {
    const baseline = this.deps.reconcile();
    const allowedTopics = new Set(input.topicIds?.map((value) => value.trim()).filter(Boolean) ?? []);
    const selected = baseline.items
      .filter((item) => item.status === 'ready_for_review')
      .filter((item) => !allowedTopics.size || allowedTopics.has(item.topic_id))
      .slice(0, input.maxTopics ?? 3);
    const requestedEvidenceIds = selected
      .flatMap((item) => item.eligible_parent_evidence.map((candidate) => candidate.evidence_id))
      .slice(0, input.maxEvidence ?? 6);
    const recovered = await this.deps.recover({
      evidenceIds: requestedEvidenceIds,
      maxTargets: requestedEvidenceIds.length,
      maxSourcesPerTarget: input.maxSources ?? 4,
      includeEvidenceGrade: true,
      requireTopicTitleMatch: false,
    });
    const session = recovered.report.auto_intake_ready_count
      ? this.deps.appendRetrievedSourceIntake(recovered.retrieval)
      : null;
    let autonomy: { published: number; held: number } | null = null;
    if (session) {
      const bundle = await this.deps.runIntakeAgent();
      await this.deps.runAiShadow();
      const result = this.deps.runAutonomousResearch(bundle, input.publish === true);
      autonomy = { published: result.report.published_count, held: result.report.held_count };
    }
    return { baseline, selectedTopicIds: selected.map((item) => item.topic_id), requestedEvidenceIds, recovered, session, autonomy };
  }
}
