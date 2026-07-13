import type { RunContext } from '../../types/run_context';

export interface RunPipelineUseCaseDeps {
  writePipelineOutputs(outputDir: string, context: RunContext): unknown;
}

export class RunPipelineUseCase {
  constructor(private readonly deps: RunPipelineUseCaseDeps) {}

  execute(context: RunContext, outputDir = 'outputs'): unknown {
    return this.deps.writePipelineOutputs(outputDir, context);
  }
}
