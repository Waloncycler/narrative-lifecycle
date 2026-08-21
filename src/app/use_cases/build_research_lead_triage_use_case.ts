import { buildResearchLeadTriage } from '@/features/research/domain/research_lead_triage';
import type { DirectSourceResearchReport } from '@/features/research/types/direct_source_research';
import type { AuthoritativeSourceAtlas, CompanyResearchRegistry } from '@/features/research/types/research_coverage';
import type { ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';
import type { WebResearchReport } from '@/features/research/types/web_research';

export interface BuildResearchLeadTriageUseCaseDeps {
  now(): string;
  producerVersion(): string;
  readWebResearch(): WebResearchReport | null;
  readDirectResearch(): DirectSourceResearchReport | null;
  readSourceAtlas(): AuthoritativeSourceAtlas;
  readCompanies(): CompanyResearchRegistry;
  writeReport(report: ResearchLeadTriageReport): void;
  validateReport(report: ResearchLeadTriageReport): void;
}

/** Builds a review-only queue from current discovery artifacts. It intentionally
 * has no import, topic activation, Stage, or scoring dependency. */
export class BuildResearchLeadTriageUseCase {
  constructor(private readonly deps: BuildResearchLeadTriageUseCaseDeps) {}

  execute(input: { webResearch?: WebResearchReport | null; directResearch?: DirectSourceResearchReport | null } = {}): ResearchLeadTriageReport {
    const report = buildResearchLeadTriage({
      webResearch: input.webResearch === undefined ? this.deps.readWebResearch() : input.webResearch,
      directResearch: input.directResearch === undefined ? this.deps.readDirectResearch() : input.directResearch,
      sourceAtlas: this.deps.readSourceAtlas(),
      companies: this.deps.readCompanies(),
      generatedAt: this.deps.now(),
      producerVersion: this.deps.producerVersion(),
    });
    this.deps.validateReport(report);
    this.deps.writeReport(report);
    return report;
  }
}
