import { recoverHistoricalProvenance, selectHistoricalProvenanceTargets } from '@/features/research/domain/historical_provenance_recovery';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { HistoricalProvenanceRecoveryReport } from '@/features/research/types/historical_provenance_recovery';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';

export interface RecoverHistoricalProvenanceUseCaseDeps {
  now(): string;
  producerVersion(): string;
  readEvidence(): EvidenceNode[];
  readAdmittedEvidenceIds(): Set<string>;
  readRegistry(): TopicRegistry;
  searchProvider(): string;
  search(input: { query: string }): Promise<Array<{ title?: string; url?: string; snippet?: string; source_name?: string; published_at?: string | null }>>;
  retrieve(input: { url: string; timeoutMs: number }): Promise<{ httpStatus: number; contentType: string | null; body: string }>;
  write(report: HistoricalProvenanceRecoveryReport): void;
  validate(report: HistoricalProvenanceRecoveryReport): void;
}

export class RecoverHistoricalProvenanceUseCase {
  constructor(private readonly deps: RecoverHistoricalProvenanceUseCaseDeps) {}

  async execute(input: {
    maxTargets?: number;
    maxSourcesPerTarget?: number;
    timeoutMs?: number;
    evidenceIds?: string[];
    includeEvidenceGrade?: boolean;
    requireTopicTitleMatch?: boolean;
    sourceUrlsByEvidenceId?: Record<string, string[]>;
  } = {}): Promise<{ report: HistoricalProvenanceRecoveryReport; retrieval: ResearchSourceRetrievalReport }> {
    const generatedAt = this.deps.now();
    const explicitEvidenceIds = new Set(input.evidenceIds ?? []);
    const admittedEvidenceIds = this.deps.readAdmittedEvidenceIds();
    // An explicit recovery request means the admitted row has failed a later
    // provenance audit. It must be recoverable without deleting history first.
    for (const evidenceId of explicitEvidenceIds) admittedEvidenceIds.delete(evidenceId);
    const targets = selectHistoricalProvenanceTargets({
      evidence: this.deps.readEvidence().filter((item) => !explicitEvidenceIds.size || explicitEvidenceIds.has(item.evidence_id)), registry: this.deps.readRegistry(), admittedEvidenceIds, limit: input.maxTargets ?? 3,
      includeEvidenceGrade: input.includeEvidenceGrade,
      requireTopicTitleMatch: input.requireTopicTitleMatch ?? (explicitEvidenceIds.size ? false : undefined),
    });
    const report = await recoverHistoricalProvenance({
      targets, generatedAt, producerVersion: this.deps.producerVersion(), searchProvider: this.deps.searchProvider(),
      search: (query) => this.deps.search({ query }),
      retrieve: (url) => this.deps.retrieve({ url, timeoutMs: input.timeoutMs ?? 15_000 }),
      maxSourcesPerTarget: input.maxSourcesPerTarget ?? 4,
      sourceUrlsByEvidenceId: input.sourceUrlsByEvidenceId,
    });
    this.deps.validate(report);
    this.deps.write(report);
    const items = report.items.flatMap((item) => item.retrieved_sources);
    return {
      report,
      retrieval: {
        artifact_type: 'research_source_retrieval_report', schema_version: '1.0.0', producer_version: this.deps.producerVersion(),
        retrieval_run_id: `${report.recovery_run_id}_sources`, generated_at: generatedAt, triage_id: null,
        requested_count: items.length,
        retrieved_count: items.filter((item) => item.status === 'retrieved').length,
        skipped_count: items.filter((item) => item.status === 'skipped').length,
        failed_count: items.filter((item) => item.status === 'failed').length,
        items,
        guardrail_check: { only_governed_source_classes_requested: true, bounded_excerpts_only: true, original_url_preserved: true, no_auto_evidence_import: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_trading_advice: true },
      },
    };
  }
}
