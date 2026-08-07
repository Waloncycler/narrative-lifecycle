import { buildResearchCampaign } from '../../domain/research_coverage';
import type { TopicRegistry } from '../../types/topic_resolution';
import type { AuthoritativeSourceAtlas, CompanyResearchRegistry, ResearchCampaign, ResearchUniverse } from '../../types/research_coverage';
import type { ResearchBaselineCompletionReport } from '../../types/research_baseline_completion';

export interface BuildResearchCampaignUseCaseDeps {
  now(): string;
  producerVersion(): string;
  readRegistry(): TopicRegistry;
  readSourceAtlas(): AuthoritativeSourceAtlas;
  readUniverse(): ResearchUniverse;
  readCompanyRegistry(): CompanyResearchRegistry;
  buildBaselineCompletion?(): ResearchBaselineCompletionReport;
  writeCampaign(campaign: ResearchCampaign): void;
  validateCampaign(campaign: ResearchCampaign): void;
}

export class BuildResearchCampaignUseCase {
  constructor(private readonly deps: BuildResearchCampaignUseCaseDeps) {}

  execute(input: { maxTasks?: number } = {}): ResearchCampaign {
    const baselineCompletion = this.deps.buildBaselineCompletion?.() ?? null;
    const campaign = buildResearchCampaign({
      registry: this.deps.readRegistry(),
      atlas: this.deps.readSourceAtlas(),
      universe: this.deps.readUniverse(),
      companies: this.deps.readCompanyRegistry(),
      generatedAt: this.deps.now(),
      producerVersion: this.deps.producerVersion(),
      maxTasks: input.maxTasks,
      baselineCompletion,
    });
    this.deps.validateCampaign(campaign);
    this.deps.writeCampaign(campaign);
    return campaign;
  }
}
