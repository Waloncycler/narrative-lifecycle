# Changelog

## [Unreleased] - 2026-08-14

### Added
- Added `npm run topic:names:normalize` for curated Chinese Topic naming, exact-name duplicate consolidation, Evidence/Branch reassignment, immutable-history preservation, stage recomputation, and governance audit.
- Added a Gate Source Strategy that maps stable-label, capital, pricing, and hard-reality gaps to authority-constrained searches, relevant company IR sources, bilingual-capable source coverage, and independent-publisher replacement targets.
- Expanded the governed Source Atlas from 46 to 54 sources with SZSE, BSE, NEEQ, China Government Procurement, China Customs, Ministry of Transport, USPTO, and OECD.
- Added per-run source coverage diagnostics for targeted, discovered, citation-ready, and deliberately avoided existing source domains.
- Added `npm run stage:recompute` to rebuild every live Topic and Branch from the formal Evidence Table and persist the resulting stages to SQLite.
- Added `npm run coverage:acquire` to execute the ranked gate acquisition worklist through scoped web search, source retrieval, Intake Agent analysis, governed admission, and stage writeback.
- Added a news-to-Evidence funnel that classifies event type, estimates evidence potential independently from readership, clusters duplicate events, maps Topic/Branch scope, and applies topic/event quotas before deep probing.
- Added prioritized-news deep probing with event-specific queries, governed source classification, bounded unknown-domain discovery, citation extraction, claim matching, and primary-source corroboration diagnostics.
- Added batch processing for the OpenAI-compatible Intake Agent. Candidate batches are isolated so one provider failure no longer forces the entire document into fallback mode.
- Added stable database-backed aliases for the latest weekly brief and immutable run-level weekly/snapshot artifacts.

### Changed
- Removed the default 180-day source-age admission cap. Historical material now follows the normal provenance, confidence, duplicate, scope, and Stage Gate rules while retaining its original dates; deployments may still opt into an explicit age cap.
- Expanded the default daily source set to 24 regulatory, disclosure, financial-news, technology, academic, and market-information sources.
- Increased news probe capacity to 24 items for quick runs, 100 for daily runs, 160 for deep runs, and 60 for manual runs.
- Intake Agent calls now default to serialized batches and retry HTTP 429/5xx responses with bounded exponential backoff.
- Agency-domain targeting now inspects both the headline and article summary when building official-source verification queries.
- Dated, substantive, governed direct-public primary records may enter the normal admission chain as rule-verified E1 candidates. This does not raise Evidence strength or Stage by itself.
- Stage Diff now reads valid history from the structured `stage_snapshots` table as well as compatible legacy artifacts, and explicitly ignores malformed historical snapshots.

### Fixed
- Localized every currently visible Topic to a market-facing Chinese name and consolidated the duplicate `solid_state_battery` / `provisional_solid_state_battery` records under the stable canonical ID without losing Evidence.
- Fixed stale database copies masking newer bundled Source Atlas versions after the SQLite migration.
- Fixed Chinese exact-topic search results being marked irrelevant by Latin-token-only matching.
- Persisted the configured MiniMax runtime locally without committing secrets, and explicitly enabled the MiniMax Intake Agent and search provider.
- Fixed autonomous runs that wrote stage artifacts without updating `topics.current_stage` or structured `stage_snapshots`.
- Fixed gate acquisition mixing current search results with stale triage/retrieval queues and reprocessing hundreds of unrelated Intake candidates.
- Fixed Chinese Topic relevance matching and added a narrow E1 perception-only path for dated Eastmoney/10jqka market-taxonomy pages; ordinary secondary news remains ineligible for automatic admission.
- Fixed database migration gaps that caused every weekly run to behave like an initial snapshot and broke continuous stage evolution timelines.
- Fixed missing latest/run-level artifact aliases used by existing CLI and dashboard readers after the SQLite migration.
- Fixed incidental Topic assignment from long news bodies and improved Chinese/English headline handling.
- Fixed provider-wide fallback behavior during large Intake Agent runs and reduced MiniMax rate-limit bursts.

### Validation
- Live gate acquisition for `solid_state_battery` searched with MiniMax, retrieved a citation-ready Eastmoney taxonomy page, passed Agent and admission checks, inserted Evidence `retrieved_2342ht`, and recomputed the parent Topic from S0 to S3 without changing its branches.
- Full operational recomputation produced 28 visible Topics: S0=1, S2=1, S3=6, S4=5, S5=1, S6=14 before the live acquisition; the remaining S0 database rows were inactive provisional discoveries without Evidence.
- `npm test` passed: 98 test files, 430 tests, 0 failures.
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
