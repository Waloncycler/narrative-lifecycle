import type { StageDiff } from '@/features/stages/types/diff';
import type { RunContext } from '@/platform/types/run_context';

export interface BuildDiffUseCaseResult {
  diff: StageDiff;
  markdown: string;
}

export interface BuildDiffUseCaseDeps {
  build(context: RunContext): BuildDiffUseCaseResult;
  persist(result: BuildDiffUseCaseResult, context: RunContext): void;
}

export class BuildDiffUseCase {
  constructor(private readonly deps: BuildDiffUseCaseDeps) {}

  execute(context: RunContext): BuildDiffUseCaseResult {
    const result = this.deps.build(context);
    this.deps.persist(result, context);
    return result;
  }
}
