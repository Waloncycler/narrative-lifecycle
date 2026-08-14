# Changelog

## [Unreleased] - 2026-08-14

### Added
- Added a news-to-Evidence funnel that classifies event type, estimates evidence potential independently from readership, clusters duplicate events, maps Topic/Branch scope, and applies topic/event quotas before deep probing.
- Added prioritized-news deep probing with event-specific queries, governed source classification, bounded unknown-domain discovery, citation extraction, claim matching, and primary-source corroboration diagnostics.
- Added batch processing for the OpenAI-compatible Intake Agent. Candidate batches are isolated so one provider failure no longer forces the entire document into fallback mode.
- Added stable database-backed aliases for the latest weekly brief and immutable run-level weekly/snapshot artifacts.

### Changed
- Expanded the default daily source set to 24 regulatory, disclosure, financial-news, technology, academic, and market-information sources.
- Increased news probe capacity to 24 items for quick runs, 100 for daily runs, 160 for deep runs, and 60 for manual runs.
- Intake Agent calls now default to serialized batches and retry HTTP 429/5xx responses with bounded exponential backoff.
- Agency-domain targeting now inspects both the headline and article summary when building official-source verification queries.
- Dated, substantive, governed direct-public primary records may enter the normal admission chain as rule-verified E1 candidates. This does not raise Evidence strength or Stage by itself.
- Stage Diff now reads valid history from the structured `stage_snapshots` table as well as compatible legacy artifacts, and explicitly ignores malformed historical snapshots.

### Fixed
- Fixed database migration gaps that caused every weekly run to behave like an initial snapshot and broke continuous stage evolution timelines.
- Fixed missing latest/run-level artifact aliases used by existing CLI and dashboard readers after the SQLite migration.
- Fixed incidental Topic assignment from long news bodies and improved Chinese/English headline handling.
- Fixed provider-wide fallback behavior during large Intake Agent runs and reduced MiniMax rate-limit bursts.

### Validation
- Real quick research run `agent_run_20260813182746911` completed across 21 of 24 sources and produced 1,261 signals, 1,146 event clusters, 240 funnel selections, and 253 Intake candidates.
- That pre-fix run published no new Evidence: 11 source articles were citation-ready, no item completed the required corroboration package, and all 11 MiniMax batches returned HTTP 429. The retry, official-primary E1, larger-probe, and agency-query changes were applied after this baseline and require the next live daily/deep run for production validation.
- `npm run typecheck` passed.
- `npm test` passed: 94 test files, 420 tests, 0 failures.
- Golden cases passed: 3/3.
- Research-only, Evidence Table, Stage First/Score Second, Parent/Branch separation, Data Confidence, and no-trading-advice guardrails remain enforced.

## [0.14.0] - 2026-08-13

### Changed
- **Architecture Refactoring (DDD & SQLite migration)**:
  - Completely removed filesystem-based JSON output artifacts in favor of a centralized SQLite database (`data/narrative.db`).
  - Deprecated and removed the `outputs` directory.
  - Replaced legacy Ajv-based JSON schema validation with a unified `FileSchemaValidator` using Zod.
  - Refactored `TopicRegistryArtifactRepository` and related classes to fully align with Domain-Driven Design (DDD) principles.
  - Migrated CLI tools (`pipeline`, `diff`, `report`, `weekly`) to interact exclusively with the SQLite database via Drizzle ORM.
  - The `systemRuns` and `stageDiffs` tables are now the primary source of truth for pipeline execution states and snapshots.

### Removed
- **Legacy Files and Directories**:
  - `outputs/`: Replaced by SQLite artifacts.
  - `schemas/`: Replaced by Zod definitions in code.
  - `configs/`: Removed as part of structural cleanup.
  - `prompts/`: Removed to align with the new pipeline.
  - `scripts/`: Cleaned up legacy scripts.
  - Multiple isolated integration tests that relied on the removed file structures.
