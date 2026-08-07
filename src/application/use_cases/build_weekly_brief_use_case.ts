import type { WeeklyBrief } from '../../types/report';
import type { RunContext } from '../../types/run_context';

export interface BuildWeeklyBriefUseCaseResult {
  report: WeeklyBrief;
  markdown: string;
}

export interface BuildWeeklyBriefUseCaseDeps {
  build(context?: RunContext): BuildWeeklyBriefUseCaseResult;
  persist(result: BuildWeeklyBriefUseCaseResult, context: RunContext): void;
}

export class BuildWeeklyBriefUseCase {
  constructor(private readonly deps: BuildWeeklyBriefUseCaseDeps) {}

  execute(context?: RunContext): BuildWeeklyBriefUseCaseResult {
    const result = this.deps.build(context);
    this.deps.persist(result, {
      run_id: result.report.run_id,
      started_at: result.report.generated_at,
      rule_version: result.report.rule_version,
      artifact_version: result.report.producer_version,
    });
    return result;
  }
}
