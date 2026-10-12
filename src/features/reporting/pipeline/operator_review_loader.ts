import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StageDiff } from '@/features/stages/types/diff';
import type { OperatorReviewRunEntry } from '@/features/reporting/types/operator_review';
import type { WeeklyBrief } from '@/features/reporting/types/report';
import type { RunManifest } from '@/platform/types/run_context';

export interface OperatorReviewRunArtifact {
  manifest: RunManifest;
  stage_diff: StageDiff | null;
  weekly_brief: WeeklyBrief | null;
  source_artifacts: string[];
}

function readJson<T>(path: string): T {
  return readGenericArtifact(path)! as T;
}

function optionalJson<T>(path: string): T | null {
  return existsSync(path) ? readJson<T>(path) : null;
}

export function loadOperatorReviewArtifacts(repoRoot: string): OperatorReviewRunArtifact[] {
  const operatorRunsRoot = resolve(repoRoot, 'outputs/operator_runs');
  const runsRoot = hasRunArtifacts(operatorRunsRoot) ? operatorRunsRoot : resolve(repoRoot, 'outputs/runs');
  if (!existsSync(runsRoot)) return [];
  const relativeRoot = runsRoot.endsWith('/operator_runs') ? 'outputs/operator_runs' : 'outputs/runs';

  return readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('run_'))
    .map((entry) => {
      const runRoot = resolve(runsRoot, entry.name);
      const manifestPath = resolve(runRoot, 'run_manifest.json');
      if (!existsSync(manifestPath)) return null;
      const stageDiffPath = resolve(runRoot, 'stage_diff.json');
      const weeklyBriefPath = resolve(runRoot, 'weekly_brief.json');
      const sourceArtifacts = [
        `${relativeRoot}/${entry.name}/run_manifest.json`,
        ...(existsSync(stageDiffPath) ? [`${relativeRoot}/${entry.name}/stage_diff.json`] : []),
        ...(existsSync(weeklyBriefPath) ? [`${relativeRoot}/${entry.name}/weekly_brief.json`] : []),
      ];
      return {
        manifest: readJson<RunManifest>(manifestPath),
        stage_diff: optionalJson<StageDiff>(stageDiffPath),
        weekly_brief: optionalJson<WeeklyBrief>(weeklyBriefPath),
        source_artifacts: sourceArtifacts,
      };
    })
    .filter((artifact): artifact is OperatorReviewRunArtifact => artifact !== null)
    .sort((a, b) => a.manifest.started_at.localeCompare(b.manifest.started_at));
}

function hasRunArtifacts(root: string): boolean {
  return existsSync(root) && readdirSync(root, { withFileTypes: true })
    .some((entry) => entry.isDirectory() && entry.name.startsWith('run_') && existsSync(resolve(root, entry.name, 'run_manifest.json')));
}

export function runEntry(artifact: OperatorReviewRunArtifact): OperatorReviewRunEntry {
  return {
    run_id: artifact.manifest.run_id,
    started_at: artifact.manifest.started_at,
    completed_at: artifact.manifest.completed_at,
    status: artifact.manifest.status,
    guardrail_status: artifact.manifest.guardrail_status,
    has_stage_diff: artifact.stage_diff !== null,
    has_weekly_brief: artifact.weekly_brief !== null,
  };
}
