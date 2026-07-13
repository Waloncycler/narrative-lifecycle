# CHANGELOG

## v0.1-handoff

- Added project constitution in `AGENTS.md`.
- Added S0-S7 lifecycle documentation.
- Added scoring system v0.2.
- Added evidence table design.
- Added Narrative Tree, Early Radar, Failure Case Library.
- Added Narrative Memory Bank and Reactivation Engine.
- Added architecture, migration, performance, evaluation, and operational workflow docs.
- Added JSON schemas and golden cases.

## v0.1-rule-based-mvp-scaffold

- Added rule-based domain models for evidence, scoring, narrative trees, reactivation, audit, and incremental update markers.
- Added explicit Stage Gate, evidence strength, data confidence, misclassification, scoring, and reactivation rules.
- Added service scaffolding for evidence validation, stage classification, scoring, dashboard cards, memory lookup, reactivation, early radar, failure cases, and versioning/audit.
- Replaced initial stub tests with rule-based coverage for golden cases, Stage Gates, Parent vs Branch separation, Data Confidence caps, scoring order, Narrative Memory/Reactivation, Early Radar, audit/versioning, failure cases, and asset quality.
- Expanded failure case calibration fixtures and sample evidence metadata.
- Updated dashboard card examples to include `why_not_higher_stage` and research-only actions.
- Tightened prompts so LLM work stays evidence-first and does not directly produce numeric scores.

## v0.1-executable-backend

- Added `npm run pipeline` for an executable rule-based backend run.
- Added pipeline artifacts under `outputs/` for dashboard cards, scores, golden results, Early Radar candidates, evaluation summary, and system summary.
- Added schema validation before writing generated dashboard, score, and Early Radar artifacts.
- Added CLI regression coverage for generated artifacts.
- Tightened scoring so parent dimensions use parent-scoped Stage Gate evidence and branch dimensions remain separate.

## v0.1-operator-report

- Added `npm run report` for operator-facing weekly narrative brief generation.
- Added weekly brief Markdown and JSON artifacts under `outputs/reports/`.
- Added `schemas/weekly_brief.schema.json` plus report schema validation and CLI regression tests.
- Preserved evidence IDs, `why_not_higher_stage`, parent vs branch separation, reactivation references, and research-only guardrails in generated reports.

## v0.2-manual-evidence-import

- Added manual evidence validation and import workflow.
- Added `npm run evidence:validate` and `npm run evidence:import`.
- Added evidence import schema, validation reports, normalized accepted imports, rejected import handling, and audit logging.
- Preserved parent vs branch scope separation and research-only guardrails before evidence enters the pipeline.

## v0.3-stage-diff

- Added previous-report stage diff workflow and `npm run diff`.
- Added stage snapshot history and report run history with schema validation.
- Added JSON and Markdown diff artifacts for stage, evidence, confidence, branch, Early Radar, and guardrail changes.
- Preserved evidence IDs, display-vs-gate stage distinction, parent-vs-branch separation, reactivation references, and research-only actions.
- Changed pipeline cleanup ownership so persisted history survives later pipeline runs.

## v0.3.1-run-history-report-integration

- Added unique run identity and injected clock support.
- Added immutable per-run artifacts and schema-valid run manifests.
- Prevented same-day stage snapshot and report overwrites.
- Added atomic snapshot, diff, report, and latest-pointer writes.
- Integrated canonical stage diff summaries into weekly briefs without duplicating diff logic.
- Added `npm run weekly` for the pipeline-diff-report operator workflow.
- Preserved evidence traceability, parent-vs-branch separation, research-only actions, and no-trading-advice guardrails.

## v0.3.2-historical-operator-review

- Added `npm run review` for historical operator review generation.
- Added operator review types, schema, loader, aggregator, Markdown renderer, CLI, and tests.
- Aggregates immutable run manifests, stage diffs, and weekly briefs without reclassifying, rescoring, inferring evidence, mutating history, or lifting parent narratives from branch changes.
- Reports review windows, run success/failure counts, stage and evidence trends, `why_not_higher_stage` changes, Data Confidence changes, branch mutations, Early Radar changes, guardrail regressions, repeated issues, consecutive `no_change` topics, high-priority alerts, and research-only next actions.
- Handles empty history as schema-valid `insufficient_history` output.

## v0.4-product-core-hardening

- Added layered architecture, repository contracts, versioned artifact contracts, in-memory test adapters, compatibility policy, and architectural boundary tests.
- Added Application use cases for evidence import, pipeline runs, canonical diff builds, weekly brief builds, operator review builds, and weekly orchestration.
- Added Infrastructure adapters for file-backed artifacts, runs, history, reviews, YAML loading, schema validation, atomic writing, and system clock access.
- Added shared artifact metadata fields to stable public artifacts: `artifact_type`, `schema_version`, `producer_version`, `rule_version`, `run_id`, and `generated_at`.
- Added schema compatibility documentation and explicit old-schema rejection coverage.
- Preserved CLI compatibility, parent-vs-branch separation, research-only actions, and no-trading-advice guardrails.

## v0.4.1-service-layer-cleanup

- Migrated legacy domain rules and infrastructure concerns out of `src/services`, added parity and dependency-boundary tests, preserved CLI and artifact compatibility, and reduced legacy coupling.
- Added `docs/22_legacy_service_migration.md` and `docs/legacy_service_inventory.json` to classify remaining service files as `domain_rule`, `application_orchestration`, `infrastructure_io`, `renderer`, or `deprecated`.
- Moved evidence import validation rules to Domain, evidence import normalization to Application, and evidence import YAML/schema/file/audit I/O to Infrastructure.
- Moved Evidence Table guards, Stage Classification, Scoring, Stage Diff, Dashboard Card guardrails, Memory/Reactivation, Early Radar, Failure Case rules, Evaluation calibration, and Versioning into Domain.
- Moved run context creation and environment mapping into Infrastructure.
- Left compatibility wrappers in `src/services` so existing imports and CLI behavior remain stable.
- Added service-layer parity tests, artifact semantic snapshot tests, legacy inventory tests, and stricter architecture boundary tests.

## v0.5-live-research-pilot

- Added a real-topic research pilot ledger for hypothesis updates, competing explanations, event intensity, tail structure, falsification tracking, operator agreement, and outcome evaluation.
- Added `npm run pilot:init` to seed manual pilot topic and operator-observation YAML files.
- Added `npm run pilot:review` to aggregate existing run, weekly brief, canonical diff, operator review, pilot topic, and operator-observation inputs.
- Added Pilot schemas, types, Domain rules, Application use cases, Infrastructure file adapter, Markdown renderer, CLI commands, and tests.
- Preserved the rule that Pilot records and evaluates only; it does not reclassify, rescore, infer evidence, produce precise probabilities, mutate historical artifacts, or lift parent narratives from branch mutations.
- Limited Pilot actions to research-only actions and preserved no-trading-advice guardrails.

## v0.5.1-historical-narrative-replay

- Added `available_at` to Evidence and manual evidence import so historical replay can run without future-evidence leakage.
- Added `npm run replay` for time-sliced historical narrative replay.
- Added replay types, schema, Domain rules, Application use case, Infrastructure adapter, Markdown renderer, CLI, fixtures, and tests.
- Added replay coverage for success, failure, S7B, S7C branch mutation, parent/branch separation, and long `no_change`.
- Replay reports stage paths, future evidence excluded, misclassification, lead time, missed changes, false positives, and calibration suggestions.
- Preserved the rule that replay does not use outcome, future evidence, price movement, or branch evidence to lift parent stage.

## v0.5.2-friendly-operator-guide

- Added `docs/QUICKSTART.md`, `docs/OPERATOR_GUIDE.md`, `docs/EVIDENCE_GUIDE.md`, `docs/REPLAY_GUIDE.md`, and `docs/TROUBLESHOOTING.md`.
- Reframed operator documentation around recording evidence, running weekly, inspecting changes, and recording outcomes.
- Added a complete example from new Evidence through weekly, review, and pilot outcome recording.
