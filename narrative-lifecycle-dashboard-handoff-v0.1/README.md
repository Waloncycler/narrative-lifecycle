# Narrative Lifecycle Dashboard

一个基于“名、资、定价、实、势、阻力、数据置信度”的 Narrative Lifecycle 研究系统。

## What This Is

This project helps researchers classify market narratives into S0-S7 lifecycle stages, track stage transitions, discover early opportunities, identify old-theme reactivation, and avoid narrative traps.

中文定位：

> 这不是热点榜，也不是自动交易系统，而是一个 **Narrative State Change Detector：叙事状态变化识别系统**。

## What This Is Not

- Not a buy/sell signal system.
- Not an automated trading system.
- Not a black-box LLM scoring tool.
- Not a simple news summary dashboard.

## Core Modules

1. Domain: Evidence, Topic, Branch, Stage Gate, Scoring, Reactivation, and Diff rules.
2. Application: use-case orchestration for import, pipeline, diff, weekly brief, weekly run, and historical review.
3. Infrastructure: file repositories, YAML loading, schema validation, atomic writing, run history, and system clock adapters.
4. Interface: CLI commands that call Application use cases.

## Data Flow

```text
Raw source
→ Evidence extraction
→ Evidence Table
→ Narrative Memory lookup
→ Stage Gate rules
→ Scoring Engine
→ Dashboard Card / Early Radar / Weekly Brief
```

## Key Principle

```text
Evidence first. Rules second. LLM explanation third.
```

## Run The System

```bash
npm install
npm run evidence:validate
npm run evidence:import -- --file data/imports/evidence_draft.example.yaml
npm run pipeline
npm run diff
npm run report
npm run weekly
npm run review
npm run pilot:init
npm run pilot:review
npm run typecheck
npm test
```

The CLI layer is intentionally thin. It resolves the repo root, parses minimal arguments, calls Application use cases, and prints summaries. Business rules, artifact reads/writes, schema validation, and run-history mutation live behind Application and Infrastructure boundaries.

`npm run pipeline` executes the rule-based backend system and writes artifacts to `outputs/`:

- `outputs/dashboard_cards/*.json`
- `outputs/scores/*.json`
- `outputs/golden_case_results.json`
- `outputs/early_radar_candidates.json`
- `outputs/evaluation_summary.json`
- `outputs/system_summary.json`

The pipeline validates generated Dashboard Cards, Scores, and Early Radar candidates against JSON schemas before writing them.

`npm run report` reads the pipeline artifacts and writes an operator-facing weekly brief:

- `outputs/reports/weekly_brief.md`
- `outputs/reports/weekly_brief.json`

The report layer is a renderer / aggregator only. It does not reclassify stages, recalculate scores, infer new evidence, or upgrade parent narratives from branch evidence.

`npm run diff` compares current pipeline artifacts with the latest persisted stage snapshot and writes:

- `outputs/diffs/latest_stage_diff.json`
- `outputs/diffs/latest_stage_diff.md`
- `outputs/history/stage_snapshots/<snapshot_id>.json`

The diff layer only compares persisted stages, evidence IDs, branches, confidence bands, Early Radar references, and guardrails. It never classifies stages, recalculates scores, infers evidence, or emits trading actions. With no previous snapshot it saves a baseline; subsequent identical runs report `no_change`.

`npm run weekly` is the canonical operator workflow. It creates one unique run identity, then runs `pipeline -> diff -> report`, preserving immutable artifacts and a schema-valid manifest at `outputs/runs/<run_id>/run_manifest.json`. `outputs/runs/latest_run.json` only advances after a successful weekly run.

`npm run review` reads historical immutable run artifacts only:

- `outputs/runs/*/run_manifest.json`
- `outputs/runs/*/stage_diff.json`
- `outputs/runs/*/weekly_brief.json`

It writes:

- `outputs/reviews/latest_operator_review.json`
- `outputs/reviews/latest_operator_review.md`
- `outputs/reviews/history/operator_review_<run_id>.json`

The review layer aggregates historical operator evidence: run success/failure counts, stage trend history, evidence changes, Data Confidence changes, `why_not_higher_stage` changes, branch mutations, Early Radar changes, guardrail regressions, repeated issues, consecutive `no_change` topics, and research-only next actions. It does not reclassify narratives, recalculate scores, infer evidence, mutate history, or lift a parent narrative because a branch changed.

`npm run pilot:init` creates the manual pilot seed files for a 4-6 week live research trial:

- `data/pilot/pilot_topics.yaml`
- `data/pilot/operator_observations.yaml`

`npm run pilot:review` reads existing run, weekly brief, diff, operator review, and pilot YAML files, then writes:

- `outputs/pilot/latest_research_ledger.json`
- `outputs/pilot/latest_research_ledger.md`
- `outputs/pilot/history/research_ledger_<run_id>.json`
- `outputs/pilot/pilot_evaluation_summary.json`

The Pilot layer only records, compares, and evaluates existing artifacts plus manual operator observations. It does not reclassify stages, rescore topics, infer evidence, produce precise probabilities, or upgrade a parent narrative because a branch changed. Each pilot topic must include a current hypothesis, competing hypothesis, falsification trigger, `why_not_higher_stage`, operator agreement, and outcome status. Allowed next actions are limited to `observe`, `wait`, `validate`, `review`, `monitor`, and `flag_risk`.

`npm run evidence:validate` checks a manual evidence draft before it can enter the pipeline. By default it reads:

- `data/imports/evidence_draft.example.yaml`

It writes:

- `outputs/imports/evidence_validation_report.json`
- `outputs/imports/evidence_validation_report.md`

`npm run evidence:import -- --file <path>` validates, normalizes, and imports accepted evidence. It writes:

- `outputs/imports/evidence_import_report.json`
- `outputs/imports/evidence_import_report.md`
- `data/imports/accepted/<import_id>.yaml`
- `data/sample_evidence/manual_imported_evidence.yaml`
- `data/audit/evidence_import_audit.jsonl`

The evidence import layer only validates, normalizes, rejects, accepts, and audits. Stage classification and scoring still only happen in `npm run pipeline`.

## MVP Scope

The MVP is a semi-automatic research system using YAML/Markdown/JSON schemas and explicit rule tests. It does not need full data automation or a web UI in Phase 1.

## Golden Cases

See `data/golden_cases/`:

- `bci.yaml`
- `humanoid_robotics.yaml`
- `innovative_drug_license_out.yaml`

## Current Executable Scope

1. Load YAML topics, evidence, golden cases, failure cases, and evaluations.
2. Run Stage Gate classification before scoring.
3. Generate Score outputs with stage snapshots and evidence IDs.
4. Generate Dashboard Cards with structured branches, structured key events, `why_not_higher_stage`, and research-only actions.
5. Generate Early Radar candidates only after Narrative Memory / Reactivation references.
6. Generate failure-case calibration summaries.
7. Generate an operator weekly brief from existing pipeline artifacts.
8. Validate and import manual evidence drafts before they enter the pipeline.
9. Compare current and previous report runs with schema-valid stage-diff history.
10. Preserve immutable per-run snapshot, diff, report, and run-manifest artifacts.
11. Generate historical operator reviews from immutable run artifacts.
12. Enforce v0.4 layered architecture boundaries and versioned public artifact metadata.
13. Generate a live research pilot ledger for 10-15 real topics without reclassification, rescoring, probability modeling, UI, database, or automated ingestion.

## v0.4 Product Core

Repository contracts are defined for Evidence, Topic, Artifact, Run, History, Failure Case, Review, and Golden Case access. File-system implementations back the current CLI, and InMemory implementations support fast use-case tests. PostgreSQL remains out of scope.

Stable public artifacts now include:

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

See `docs/21_schema_compatibility_and_migration.md` for compatibility and migration policy.

## v0.4.1 Service Cleanup

Legacy service inventory and migration status are tracked in:

- `docs/22_legacy_service_migration.md`
- `docs/legacy_service_inventory.json`

Migrated implementation code now lives in the layered core:

- Domain rules: evidence import validation, Evidence Table guards, Stage Classification, Scoring, Stage Diff, Dashboard Card guardrails, Memory/Reactivation, Early Radar, Failure Case rules, Evaluation calibration, and Versioning.
- Application logic: evidence import normalization and use-case orchestration.
- Infrastructure: evidence import YAML/schema/file/audit I/O and run context.

`src/services/*` remains as compatibility wrappers plus explicitly inventoried legacy-active files. New code should import from `src/domain`, `src/application`, or `src/infrastructure` directly.

See `docs/20_system_summary.md` for the system checklist and current architecture.
