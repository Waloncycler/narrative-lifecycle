export const ARTIFACT_SCHEMA_VERSION = '1.0.0';
export const PRODUCER_VERSION = '0.4.0';

export interface ArtifactMetadata {
  artifact_type: string;
  schema_version: string;
  producer_version: string;
  rule_version: string;
  run_id: string;
  generated_at: string;
}

export function artifactMetadata(input: {
  artifact_type: string;
  rule_version: string;
  run_id: string;
  generated_at: string;
}): ArtifactMetadata {
  return {
    artifact_type: input.artifact_type,
    schema_version: ARTIFACT_SCHEMA_VERSION,
    producer_version: PRODUCER_VERSION,
    rule_version: input.rule_version,
    run_id: input.run_id,
    generated_at: input.generated_at,
  };
}
