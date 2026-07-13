# Schema Compatibility And Migration

## Artifact Contract

Stable public artifacts produced by the product core include a shared metadata envelope:

```json
{
  "artifact_type": "string",
  "schema_version": "1.0.0",
  "producer_version": "0.4.0",
  "rule_version": "string",
  "run_id": "string",
  "generated_at": "ISO_TIMESTAMP"
}
```

This metadata separates the public artifact contract from internal domain models, persistence models, and view models.

## Model Boundaries

- Domain Model: pure evidence, stage, scoring, reactivation, and diff rules. No filesystem, YAML, CLI, or `outputs/` paths.
- Persistence Model: local YAML/JSON files and immutable run-history layout.
- Public Artifact Contract: schema-valid JSON artifacts under `outputs/`.
- View Model: Markdown reports and future UI projections derived from public artifacts.

## Compatibility Policy

v0.4 requires explicit artifact metadata on stable JSON artifacts. Old artifacts without `artifact_type`, `schema_version`, `producer_version`, `rule_version`, `run_id`, and `generated_at` are rejected by the v0.4 schemas unless a future migration explicitly upgrades them.

The current compatibility stance is strict:

- accept v0.4 artifacts with `schema_version: "1.0.0"`;
- reject older unversioned stage diff and run manifest artifacts at schema boundaries;
- keep convenience latest files backward-readable by services where safe, but require v0.4 metadata before writing new public artifacts;
- do not infer missing metadata during review, diff, report, scoring, or classification.

## Migration Path

Future migrations should be explicit, file-based, and test-covered:

1. Read old artifact.
2. Validate against its historical schema or a one-off legacy detector.
3. Produce a new v0.4-compatible artifact with metadata.
4. Preserve the original immutable file.
5. Record migration provenance in a separate audit artifact.

No migration should reclassify narratives, rescore evidence, infer missing evidence, or lift a parent narrative because a branch artifact changed.
