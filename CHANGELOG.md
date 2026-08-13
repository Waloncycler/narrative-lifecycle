# Changelog

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
