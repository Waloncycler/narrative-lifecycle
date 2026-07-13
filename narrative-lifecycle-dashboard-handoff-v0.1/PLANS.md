# PLANS.md

## Phase 0: Documentation & Schema Setup

- Create core docs from the theory package.
- Create JSON schemas.
- Add golden case YAML files.
- Add initial tests for golden cases.
- No UI and no automated ingestion yet.

## Phase 1: Rule-based MVP

- Implement stage gate rules.
- Implement evidence strength rules.
- Implement parent vs branch separation.
- Implement scoring v0.2.
- Generate Markdown dashboard cards from structured YAML.

## Phase 2: Early Radar & Reactivation

- Implement Early Opportunity Radar.
- Implement Narrative Memory Bank.
- Implement Reactivation Engine.
- Add `repeated_old_story` detection.
- Add Narrative Delta Score.

## Phase 3: Evaluation & Failure Case Calibration

- Add failure case library.
- Add evaluation results.
- Add manual override audit trail.
- Add monthly review workflow.

## Phase 4: Dashboard Card and Example Output

- Generate Markdown Dashboard Cards from golden cases.
- Ensure every card includes `why_not_higher_stage`.
- Ensure research actions remain observation, tracking, validation, or risk-alert actions.
- Generate weekly narrative brief examples from structured evidence.

## Phase 5: Failure Case Library

- Add structured calibration failure cases.
- Include time period, peak stage, failed transition, false positives, missed warnings, corrective rules, and lessons.
- Use failure cases to calibrate misclassification rules.

## Phase 6: Architecture, Versioning, Audit, and Migration Readiness

- Add schemas and types for raw source, rule version, manual override, audit log, and evaluation result.
- Add audit log utilities, manual override records, rule version constants, and evaluation result scaffolding.
- Add incremental update markers such as `dirty_flag`, `event_hash`, `evidence_hash`, and `last_processed_at`.
- Preserve traceability from generated conclusions to evidence IDs.
- Keep the migration path from local YAML/Markdown/JSON MVP to PostgreSQL/Web Dashboard explicit.

## Phase 7: Final Integration and Quality Pass

- Run all available tests.
- Validate schemas, golden cases, examples, prompts, and failure cases.
- Check documentation consistency and no-trading-advice boundaries.
- Update `CHANGELOG.md`.
- Produce final implementation summary.

## Future Phase: Web Dashboard and Data Automation

- Add database.
- Add UI for topics, branches, evidence, scores, dashboard cards.
- Add semi-automated evidence extraction.
- Add source quality scoring and automated data confidence scoring.
- Add scheduled or incremental update pipelines.

## Current Executable Backend Extension

- Add `npm run pipeline` as the canonical local backend run command.
- Write schema-valid artifacts to `outputs/`.
- Keep Stage Snapshot, evidence IDs, score IDs, branch evidence, and reactivation references visible in generated outputs.
- Add CLI regression tests so the pipeline remains executable after future changes.

## Current Operator Report Extension

- Add `npm run report` as the canonical local operator brief command.
- Read existing pipeline artifacts from `outputs/` without reclassifying or rescoring.
- Write `outputs/reports/weekly_brief.md` and `outputs/reports/weekly_brief.json`.
- Validate `weekly_brief.json` against `schemas/weekly_brief.schema.json`.
- Preserve `why_not_higher_stage`, evidence IDs, reactivation references, and research-only actions in the report.
- Fail clearly with `Please run npm run pipeline first.` when pipeline artifacts are missing.

## Current Manual Evidence Import Extension

- Add `npm run evidence:validate` for manual evidence draft validation.
- Add `npm run evidence:import` for validate-normalize-import-audit workflow.
- Write validation and import reports under `outputs/imports/`.
- Write normalized accepted imports under `data/imports/accepted/`.
- Write rejected imports under `data/imports/rejected/`.
- Write imported pipeline fixture rows to `data/sample_evidence/manual_imported_evidence.yaml`.
- Write audit records to `data/audit/evidence_import_audit.jsonl`.
- Preserve parent vs branch scope separation before imported evidence can enter `npm run pipeline`.
- Keep import layer free of stage classification, scoring, dashboard generation, Early Radar generation, LLM scoring, and trading advice.

## Current Previous Report Diff Extension

- Add `npm run diff` to compare current artifacts with the latest stage snapshot.
- Persist deterministic stage snapshots and weekly report copies under `outputs/history/`.
- Detect stage upgrades, downgrades, state-band changes, evidence changes, `why_not_higher_stage` changes, Data Confidence changes, branch mutations, Early Radar changes, and guardrail regressions.
- Preserve display stage and Stage Gate stage separately in history.
- Keep diffing mechanical and research-only: no classification, scoring, evidence inference, parent lift, or trading advice.

## Current Run History and Report Integration Extension

- Add injected `RunContext` identity and unique per-run snapshot, diff, report, and manifest artifacts.
- Add `npm run weekly` as the shared-context `pipeline -> diff -> report` workflow.
- Keep `outputs/diffs/latest_stage_diff.*` and `outputs/reports/weekly_brief.*` as convenience paths while preserving immutable `outputs/runs/<run_id>/` records.
- Build diff snapshots directly from pipeline artifacts; build weekly brief stage changes only from canonical diff artifacts.
- Update the latest successful run pointer only after the full workflow completes successfully.

## Current Historical Operator Review Extension

- Add `npm run review` to aggregate immutable run history.
- Read only `outputs/runs/*/run_manifest.json`, `stage_diff.json`, and `weekly_brief.json`.
- Write latest and historical operator review artifacts under `outputs/reviews/`.
- Summarize review window, run success/failure counts, stage trends, evidence trends, `why_not_higher_stage`, Data Confidence, branch mutation, Early Radar, guardrail regression, repeated issues, consecutive `no_change` topics, high-priority operator alerts, and research-only next actions.
- Keep review historical and mechanical: no classification, scoring, evidence inference, history mutation, branch-to-parent lift, UI, database, automated ingestion, or trading advice.

## Current Product Core Hardening Extension

- Split the product core into Domain, Application, Infrastructure, and Interface layers.
- Add Application use cases for evidence import, pipeline, diff, weekly brief, operator review, and weekly orchestration.
- Add repository contracts for Evidence, Topic, Artifact, Run, History, Failure Case, Review, and Golden Case access.
- Add file-system adapters plus InMemory test adapters; PostgreSQL remains out of scope.
- Add versioned artifact metadata to stable public artifacts.
- Add schema compatibility and migration policy documentation.
- Add architectural boundary tests to keep Domain/Application free of direct filesystem, YAML, CLI, and output-path dependencies.
- Add v0.4 product scenarios for parent/branch separation, E4 S6 movement, downgrade on evidence removal, confidence drop, S7C branch mutation, old theme reactivation, idempotent import, guardrail regression, and old-schema rejection.

## Current Service-to-Layer Cleanup Extension

- Generate a machine-readable legacy service inventory.
- Migrate pure domain rules out of `src/services` while retaining compatibility wrappers.
- Move evidence import I/O into Infrastructure and evidence import normalization into Application.
- Move run context into Infrastructure.
- Add dependency-boundary tests, legacy inventory tests, parity tests, artifact semantic snapshot tests, and CLI compatibility coverage.
- Keep remaining legacy-active services explicitly categorized with migration target and reason.
- Preserve CLI commands, artifact shapes, schemas, parent/branch separation, Stage Gate behavior, guardrails, and research-only outputs.

## Current Live Research Pilot Extension

- Add `npm run pilot:init` to create manual pilot seed files for 10-15 research topics.
- Add `npm run pilot:review` to generate a schema-valid research ledger and evaluation summary from existing artifacts plus operator observations.
- Read only latest run, weekly brief, canonical stage diff, operator review, pilot topics, and operator observations.
- Track current and competing hypotheses, prior band, posterior direction, event intensity, tail structure, strongest evidence IDs, `why_not_higher_stage`, falsification triggers, validation windows, operator agreement, comments, and outcome status.
- Summarize research time saved, operator agreement, stage-change precision, Early Radar follow-through, false positives, missed changes, falsifications, and consecutive `no_change` runs.
- Mark early or unavailable metrics as `insufficient_history`; do not invent precision or probabilities.
- Keep Pilot mechanical and research-only: no classification, scoring, evidence inference, branch-to-parent lift, UI, database, automated ingestion, source-quality model, probability model, or trading advice.

## Product Roadmap

- v0.5 Live Research Pilot
- v0.5.1 Pilot Iteration After 4-6 Weeks
- v0.6 Read-Only Operator Interface
- v0.7 PostgreSQL Adapter
