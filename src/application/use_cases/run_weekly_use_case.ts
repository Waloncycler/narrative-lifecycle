import type { RunContext, RunManifest } from '../../types/run_context';

export interface RunWeeklyUseCaseDeps {
  createRunContext(): RunContext;
  runPipeline(context: RunContext): void;
  runDiff(context: RunContext): void;
  runReport(context: RunContext): void;
  buildManifest(context: RunContext, failedCommand: string | null): RunManifest;
  validateManifest(manifest: RunManifest): void;
  writeManifest(manifest: RunManifest, updateLatest: boolean): void;
}

export class RunWeeklyUseCase {
  constructor(private readonly deps: RunWeeklyUseCaseDeps) {}

  execute(): RunManifest {
    const context = this.deps.createRunContext();
    let failedCommand: string | null = null;

    for (const [command, run] of [
      ['pipeline', () => this.deps.runPipeline(context)],
      ['diff', () => this.deps.runDiff(context)],
      ['report', () => this.deps.runReport(context)],
    ] as const) {
      try {
        run();
      } catch {
        failedCommand = command;
        break;
      }
    }

    const manifest = this.deps.buildManifest(context, failedCommand);
    this.deps.validateManifest(manifest);
    this.deps.writeManifest(manifest, failedCommand === null);
    if (failedCommand) throw new Error(`weekly command failed: ${failedCommand}`);
    return manifest;
  }
}
