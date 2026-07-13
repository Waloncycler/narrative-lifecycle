import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StageDiff } from '../types/diff';
import type { OperatorReviewRunEntry } from '../types/operator_review';
import type { WeeklyBrief } from '../types/report';
import type { RunManifest } from '../types/run_context';

export interface OperatorReviewRunArtifact {
  manifest: RunManifest;
  stage_diff: StageDiff | null;
  weekly_brief: WeeklyBrief | null;
  source_artifacts: string[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function optionalJson<T>(path: string): T | null {
  return existsSync(path) ? readJson<T>(path) : null;
}

export function loadOperatorReviewArtifacts(repoRoot: string): OperatorReviewRunArtifact[] {
  const runsRoot = resolve(repoRoot, 'outputs/runs');
  if (!existsSync(runsRoot)) return [];

  return readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('run_'))
    .map((entry) => {
      const runRoot = resolve(runsRoot, entry.name);
      const manifestPath = resolve(runRoot, 'run_manifest.json');
      if (!existsSync(manifestPath)) return null;
      const stageDiffPath = resolve(runRoot, 'stage_diff.json');
      const weeklyBriefPath = resolve(runRoot, 'weekly_brief.json');
      const sourceArtifacts = [
        `outputs/runs/${entry.name}/run_manifest.json`,
        ...(existsSync(stageDiffPath) ? [`outputs/runs/${entry.name}/stage_diff.json`] : []),
        ...(existsSync(weeklyBriefPath) ? [`outputs/runs/${entry.name}/weekly_brief.json`] : []),
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
