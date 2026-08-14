# Database Architecture Migration - Handover Document

## 1. Overview
The Narrative Lifecycle system's core storage has been migrated from flat YAML/JSON files to a relational database using **SQLite** and **Drizzle ORM**. This enables high-performance querying, robust relational integrity, and prepares the system for future migration to PostgreSQL if multi-user concurrency is required.

## 2. Structural Changes
### 2.1 Database Schema
The new schema is defined entirely in `src/db/schema.ts` and managed via Drizzle.
- `topics`: Replaces `canonical_topics.yaml` and `provisional_topics.yaml`.
- `branches`: Replaces `branches.yaml`.
- `evidence`: Replaces `live_evidence/automated_evidence.yaml` and handles all EvidenceNode storage.
- `raw_documents`: Safely stores source ingestion strings.
- `intake_sessions`: Replaces scattered Intake Session JSON dumps, utilizing JSON-stringified payloads for deeply nested candidates to maintain SQLite speed.

### 2.2 Dependency Injection (`FileSystemAdapters`)
The old `File*Repository` classes were bypassed for core domain entities. They were replaced with:
- `DbTopicRegistryRepository`
- `DbAutonomousResearchRepository`
- `DbIntakeRepository`

These are injected in `src/platform/io/file_system_adapters.ts`. Legacy file repositories are kept as fallbacks solely for rendering Markdown artifacts and maintaining backwards-compatible CLI report views.

### 2.3 Removed Artifacts
The following files were securely migrated to the database (`data/narrative.db`) and subsequently **deleted** to prevent stale reads/writes:
- `data/topic_registry/canonical_topics.yaml`
- `data/topic_registry/branches.yaml`
- `data/topic_registry/provisional_topics.yaml`
- `data/topic_registry/aliases.yaml`
- `data/topic_registry/narrative_memory.yaml`
- `data/live_evidence/automated_evidence.yaml`
- `src/cli/run_db_migrate.ts` (one-off script, deleted post-run)

## 3. Operations & Maintenance

### 3.0 Current Compatibility Contract

SQLite is the source of truth, but the application still maintains stable logical artifact ids for existing CLI and dashboard readers. In particular, latest and immutable run-level weekly briefs and stage snapshots are stored in `generic_artifacts` alongside their structured-table records.

Do not assume that every `outputs/...` reference is a physical file. Some are compatibility ids resolved through the database. Do not remove these aliases until every interface reader has migrated to typed repositories.

Stage history must be read from `stage_snapshots`; compatible legacy history in `generic_artifacts` may be considered only after full shape validation. Malformed or adjacent legacy artifacts must be ignored rather than used for Diff.

### 3.1 Viewing Data
You can inspect the database locally using Drizzle Studio:
```bash
npx drizzle-kit studio
```
This opens a local web interface to query and edit the SQLite database directly.

### 3.2 Schema Modifications
If you need to add a field or a new table:
1. Update `src/db/schema.ts`.
2. Run `npx drizzle-kit generate` to create the SQL migration.
3. Run `npx drizzle-kit push` to apply it to `data/narrative.db`.

### 3.3 Upgrading to PostgreSQL
The architecture was chosen specifically for this capability. When ready:
1. Swap `better-sqlite3` for `pg` in `package.json`.
2. Change the dialect in `drizzle.config.ts` from `sqlite` to `postgresql`.
3. Switch `text()` JSON fields in `schema.ts` to native `jsonb()`.
4. Run `drizzle-kit push`.
