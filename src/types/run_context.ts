import type { ArtifactMetadata } from './artifact_contract';

export interface RunContext {
  run_id: string;
  started_at: string;
  rule_version: string;
  artifact_version: string;
}

export interface RunManifest extends RunContext, ArtifactMetadata {
  completed_at: string;
  status: 'ok' | 'failed';
  commands: string[];
  artifacts: string[];
  previous_run_id: string | null;
  current_snapshot_id: string | null;
  previous_snapshot_id: string | null;
  guardrail_status: 'ok' | 'review_required';
}
