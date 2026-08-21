import type { RunContext } from '@/platform/types/run_context';

export interface RunPipelineUseCaseDeps {
  writePipelineOutputs(outputDir: string, context: RunContext): unknown;
  recomputeOperationalState?(context: RunContext): void;
}

export class RunPipelineUseCase {
  constructor(private readonly deps: RunPipelineUseCaseDeps) {}

  execute(context: RunContext, outputDir = 'outputs'): unknown {
    const result = this.deps.writePipelineOutputs(outputDir, context);
    this.deps.recomputeOperationalState?.(context);
    return result;
  }
}
