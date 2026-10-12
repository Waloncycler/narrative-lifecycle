import { buildFailedSourceItem, buildRetrievedSourceItem, selectSourceRetrievalTargets } from '@/features/research/domain/research_source_retrieval';
import { isFinancialNewsProbe, isUnknownDiscoveryProbe } from '@/features/research/domain/research_source_retrieval';
import { executeDeepMiningProbe } from '@/features/research/domain/deep_mining_probes';
import { buildResearchSourceQualityReport } from '@/features/research/domain/research_source_quality';
import type { ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';
import type { ResearchSourceRetrievalItem } from '@/features/research/types/research_source_retrieval';
import type { ResearchSourceQualityReport } from '@/features/research/types/research_source_quality';
import type { SourceGovernancePolicy } from '@/features/research/types/research_coverage';

export interface RetrieveResearchSourcesUseCaseDeps {
  now(): string;
  producerVersion(): string;
  readLeadTriage(): ResearchLeadTriageReport | null;
  readGovernancePolicy(): SourceGovernancePolicy;
  retrieve(input: { url: string; timeoutMs: number }): Promise<{ httpStatus: number; contentType: string | null; body: string }>;
  writeReport(report: ResearchSourceRetrievalReport): void;
  validateReport(report: ResearchSourceRetrievalReport): void;
  writeQualityReport(report: ResearchSourceQualityReport): void;
  validateQualityReport(report: ResearchSourceQualityReport): void;
}

/** Fetches a bounded set of already-governed review leads. The result is an
 * auditable source package, not an Evidence import or lifecycle decision. */
export class RetrieveResearchSourcesUseCase {
  constructor(private readonly deps: RetrieveResearchSourcesUseCaseDeps) {}

  async execute(input: { maxItems?: number; maxUnknownDiscoveryItems?: number; timeoutMs?: number; triage?: ResearchLeadTriageReport | null } = {}): Promise<ResearchSourceRetrievalReport> {
    const generatedAt = this.deps.now();
    const triage = input.triage === undefined ? this.deps.readLeadTriage() : input.triage;
    const policy = this.deps.readGovernancePolicy();
    const targets = selectSourceRetrievalTargets(triage, input.maxItems ?? 6, input.maxUnknownDiscoveryItems ?? 2, policy);
    const items: ResearchSourceRetrievalItem[] = [];
    for (const lead of targets) {
      try {
        const page = await this.deps.retrieve({ url: lead.url, timeoutMs: input.timeoutMs ?? 15_000 });
        // Secondary financial media is not Evidence. A distinct deep probe
        // only produces a bounded citation package for downstream source
        // recovery and candidate review.
        items.push(isFinancialNewsProbe(lead, policy) || isUnknownDiscoveryProbe(lead)
          ? executeDeepMiningProbe({ lead, rawBody: page.body, contentType: page.contentType, fetchedAt: generatedAt, httpStatus: page.httpStatus }).retrievalItem
          : buildRetrievedSourceItem({ lead, fetchedAt: generatedAt, ...page }));
      } catch (error) {
        items.push(buildFailedSourceItem({ lead, fetchedAt: generatedAt, error: safeError(error) }));
      }
    }
    const report: ResearchSourceRetrievalReport = {
      artifact_type: 'research_source_retrieval_report', schema_version: '1.0.0', producer_version: this.deps.producerVersion(),
      retrieval_run_id: `research_source_retrieval_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
      generated_at: generatedAt, triage_id: triage?.triage_id ?? null, requested_count: targets.length,
      retrieved_count: items.filter((item) => item.status === 'retrieved').length,
      skipped_count: items.filter((item) => item.status === 'skipped').length,
      failed_count: items.filter((item) => item.status === 'failed').length,
      items,
      guardrail_check: { only_governed_source_classes_requested: true, bounded_excerpts_only: true, original_url_preserved: true, no_auto_evidence_import: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_trading_advice: true },
    };
    const quality = buildResearchSourceQualityReport(report);
    this.deps.validateReport(report);
    this.deps.validateQualityReport(quality);
    this.deps.writeReport(report);
    this.deps.writeQualityReport(quality);
    return report;
  }
}

function safeError(error: unknown): string { return (error instanceof Error ? error.message : String(error)).replace(/(api[_-]?key|authorization|token|secret)\s*[=:]\s*\S+/gi, '$1=[redacted]').slice(0, 280); }
