import { buildResearchPackTriage, selectResearchPackRetrievalTargets } from '@/features/research/domain/research_pack';
import { buildFailedSourceItem, buildRetrievedSourceItem } from '@/features/research/domain/research_source_retrieval';
import type { ResearchPack, ResearchPackRetrievalReport } from '@/features/research/types/research_pack';
import type { ResearchSourceRetrievalItem, ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';

export interface RunResearchPackUseCaseDeps {
  now(): string;
  producerVersion(): string;
  readPack(file: string): ResearchPack;
  validatePack(pack: ResearchPack): void;
  retrieve(input: { url: string; timeoutMs: number }): Promise<{ httpStatus: number; contentType: string | null; body: string }>;
  validateRetrieval(report: ResearchSourceRetrievalReport): void;
  validateReport(report: ResearchPackRetrievalReport): void;
  writeReport(report: ResearchPackRetrievalReport): void;
}

/** Retrieves a bounded, curated source set through the same citation gate as
 * discovery. It deliberately stops before Intake, Evidence import, or Stage. */
export class RunResearchPackUseCase {
  constructor(private readonly deps: RunResearchPackUseCaseDeps) {}

  async execute(input: { file: string; maxItems?: number; timeoutMs?: number }): Promise<ResearchPackRetrievalReport> {
    const generatedAt = this.deps.now();
    const pack = this.deps.readPack(input.file);
    this.deps.validatePack(pack);
    const triage = buildResearchPackTriage({ pack, generatedAt, producerVersion: this.deps.producerVersion() });
    const items: ResearchSourceRetrievalItem[] = [];
    for (const lead of selectResearchPackRetrievalTargets(triage, input.maxItems ?? 12)) {
      try {
        const page = await this.deps.retrieve({ url: lead.url, timeoutMs: input.timeoutMs ?? 15_000 });
        items.push(buildRetrievedSourceItem({ lead, fetchedAt: generatedAt, ...page }));
      } catch (error) {
        items.push(buildFailedSourceItem({ lead, fetchedAt: generatedAt, error: safeError(error) }));
      }
    }
    const retrieval: ResearchSourceRetrievalReport = {
      artifact_type: 'research_source_retrieval_report', schema_version: '1.0.0', producer_version: this.deps.producerVersion(),
      retrieval_run_id: `research_pack_retrieval_${pack.pack_id}_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
      generated_at: generatedAt, triage_id: triage.triage_id, requested_count: items.length,
      retrieved_count: items.filter((item) => item.status === 'retrieved').length,
      skipped_count: items.filter((item) => item.status === 'skipped').length,
      failed_count: items.filter((item) => item.status === 'failed').length, items,
      guardrail_check: { only_governed_source_classes_requested: true, bounded_excerpts_only: true, original_url_preserved: true, no_auto_evidence_import: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_trading_advice: true },
    };
    const report: ResearchPackRetrievalReport = {
      artifact_type: 'research_pack_retrieval_report', schema_version: '1.0.0', producer_version: this.deps.producerVersion(),
      pack_id: pack.pack_id, title: pack.title, generated_at: generatedAt, research_questions: pack.research_questions,
      proposed_taxonomy: pack.proposed_taxonomy, triage, retrieval, guardrail_check: pack.guardrail_check,
    };
    this.deps.validateRetrieval(retrieval);
    this.deps.validateReport(report);
    this.deps.writeReport(report);
    return report;
  }
}

function safeError(error: unknown): string { return (error instanceof Error ? error.message : String(error)).replace(/(api[_-]?key|authorization|token|secret)\s*[=:]\s*\S+/gi, '$1=[redacted]').slice(0, 280); }
