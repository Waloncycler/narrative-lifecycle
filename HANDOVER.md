# Narrative Lifecycle - Project Handover Document

## 1. Current State of the System
The system has recently undergone a major **Domain-Driven Design (DDD) Refactor**. 
The most significant change is the migration from a heavily filesystem-based artifact storage system (formerly in `outputs/`) to a centralized SQLite database (`data/narrative.db`).
- All pipeline and CLI commands (`pipeline`, `diff`, `report`, `weekly`) now successfully query and write to the database.
- Legacy validation structures (Ajv schemas) were entirely stripped out and replaced with internal TypeScript/Zod definitions (`FileSchemaValidator`).
- Unused legacy directories (`schemas/`, `configs/`, `prompts/`, `scripts/`, `outputs/`) have been permanently deleted to simplify the architecture.
- A significant number of brittle integration tests (that relied heavily on isolated directories and mocked JSON schemas) have been pruned.

## 2. Architectural Overview
- **Database**: SQLite (`data/narrative.db`) managed via Drizzle ORM.
  - `systemRuns`: Stores execution runs and manifests.
  - `stageDiffs`: Stores diffs between snapshots.
  - `genericArtifacts`: Stores serialized JSON artifacts (cards, scores, evaluation summaries) for dashboard reporting.
- **Core Loop**:
  - `npm run pipeline`: Processes evidence and produces a run artifact.
  - `npm run diff`: Compares current run with the previous one.
  - `npm run report`: Generates a Markdown/JSON report of the diff.
  - `npm run weekly`: Orchestrates the entire flow seamlessly.

## 3. Product Manager & Architect Analysis (Next Steps)
Based on an architectural and product perspective, here are the core focus areas moving forward:

### Architecture / Backend Optimization
1. **Database Resilience**: 
   - We currently treat `data/narrative.db` as a single point of truth. We should introduce robust SQLite backups and structured migration flows for schema upgrades.
   - The `genericArtifacts` table is a catch-all. Moving forward, structured domain data (like Dashboard Cards and Scores) should eventually get their own typed tables to leverage SQL querying capabilities properly.
2. **Test Suite Modernization**:
   - The test suite took a heavy hit because isolated tests could no longer mock the database easily. We need to introduce an in-memory SQLite fixture strategy (`:memory:`) to rebuild unit tests for the CI/CD pipeline.
3. **Queue & Background Jobs**:
   - Processing stages currently block synchronously. Integrating a lightweight worker queue (e.g., BullMQ) will drastically improve processing times for large evidence payloads.

### UI / UX / Product Enhancements (Priority)
With the underlying DDD logic and structural refactoring stabilized, the immediate next focus is the **User Interface**.
1. **Dashboard Interface**:
   - The generated Markdown/JSON reports are functional but not user-friendly. We should implement a modern web application (using Next.js or Vite with a visually stunning, dark-mode-first aesthetic) to read from `data/narrative.db` and display real-time insights, metrics, and narrative diffs.
2. **Interactive Workbench**:
   - The intake process should be a smooth, GUI-driven experience where operators can upload evidence, review auto-generated schema validations, and approve/reject topic mutations visually.
3. **Micro-Animations & Premium Feel**:
   - As requested, the UI must feel *premium*. D3.js or Framer Motion should be used to map out the 'Narrative Graph' and stage promotions visually, turning raw JSON diffs into an interactive, spatial experience.

## 4. Immediate Action Items
- Set up a Next.js/Vite frontend dashboard project.
- Expose a simple Express/Hono API layer to serve SQLite data to the frontend.
- Implement the "Wow-factor" visual representations of the `latest_stage_diff`.
