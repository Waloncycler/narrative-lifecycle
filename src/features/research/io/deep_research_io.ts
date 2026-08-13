import { resolve } from 'node:path';
import type { DeepResearchSweep } from '@/features/research/types/deep_research_sweep';
import { writeGenericArtifact } from '@/platform/io/run_manifest_writer';

/**
 * File-backed repository for deep research sweep artifacts.
 *
 * Keeps a single "latest sweep" file (mirroring latest_run.json) so the
 * workbench and monitors can quickly inspect the most recent multi-round
 * deep search without scanning a history directory.
 */
export class DbDeepResearchSweepRepository {
  private readonly latestSweepPath: string;

  constructor(repoRoot: string) {
    this.latestSweepPath = resolve(repoRoot, 'outputs/research_agent/latest_deep_research_sweep.json');
  }

  writeSweep(sweep: DeepResearchSweep): void {
    writeGenericArtifact(this.latestSweepPath, sweep);
  }
}
