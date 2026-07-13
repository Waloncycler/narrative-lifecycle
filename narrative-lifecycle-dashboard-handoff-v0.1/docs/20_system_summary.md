# System Summary

## Mission

Narrative Lifecycle Dashboard is an evidence-first research decision-support system. It detects narrative state changes, validates lifecycle stages, separates parent and branch narratives, and produces traceable dashboard outputs.

It is not a trading system and does not produce buy/sell advice, target prices, position sizing, entries, exits, or execution instructions.

## Executable Backend

Run:

```bash
npm run evidence:validate
npm run evidence:import -- --file data/imports/evidence_draft.example.yaml
npm run pipeline
npm run diff
npm run report
npm run weekly
npm run review
npm run pilot:init
npm run pilot:review
npm run replay
```

The command loads local YAML fixtures, runs the rule engine, validates generated artifacts against JSON schemas, and writes:

- `outputs/dashboard_cards/*.json`
- `outputs/scores/*.json`
- `outputs/golden_case_results.json`
- `outputs/early_radar_candidates.json`
- `outputs/evaluation_summary.json`
- `outputs/system_summary.json`

Then `npm run report` reads those artifacts and writes:

- `outputs/reports/weekly_brief.md`
- `outputs/reports/weekly_brief.json`

Then `npm run diff` compares current pipeline artifacts with the latest saved snapshot and writes:

- `outputs/diffs/latest_stage_diff.json`
- `outputs/diffs/latest_stage_diff.md`
- `outputs/history/stage_snapshots/<snapshot_id>.json`

`npm run weekly` is the canonical workflow. It creates a unique run ID and performs `pipeline -> diff -> report` with the same run context. Each successful run writes immutable artifacts under `outputs/runs/<run_id>/`, including a run manifest; `outputs/runs/latest_run.json` is updated atomically only after success.

Then `npm run review` aggregates immutable historical run artifacts and writes:

- `outputs/reviews/latest_operator_review.json`
- `outputs/reviews/latest_operator_review.md`
- `outputs/reviews/history/operator_review_<run_id>.json`

The historical review reads only run manifests, canonical stage diffs, and weekly briefs under `outputs/runs/*/`. It does not reclassify stages, recalculate scores, infer evidence, mutate run history, or treat branch mutation as a parent-stage upgrade.

Then `npm run pilot:init` creates manual live-research pilot files:

- `data/pilot/pilot_topics.yaml`
- `data/pilot/operator_observations.yaml`

Then `npm run pilot:review` records and evaluates the current pilot ledger from existing artifacts and operator observations:

- `outputs/pilot/latest_research_ledger.json`
- `outputs/pilot/latest_research_ledger.md`
- `outputs/pilot/history/research_ledger_<run_id>.json`
- `outputs/pilot/pilot_evaluation_summary.json`

The Pilot layer is a 4-6 week research trial layer. It tracks 10-15 topics with current and competing hypotheses, prior band, posterior direction, event intensity, tail structure, strongest evidence IDs, `why_not_higher_stage`, falsification trigger, validation window, operator agreement, comments, and outcome status. It does not classify, score, infer evidence, produce precise probabilities, mutate historical artifacts, or treat branch mutation as parent-stage movement.

Then `npm run replay` runs historical time-slice validation:

- `data/replay/replay_cases.yaml`
- `outputs/replay/latest_replay_ledger.json`
- `outputs/replay/latest_replay_ledger.md`
- `outputs/replay/history/replay_ledger_<run_id>.json`

Replay uses each evidence row's `available_at` field to ensure the system only uses information available at the replay slice. It runs Stage, Diff, and Early Radar checks before revealing the outcome, then reports stage paths, future evidence excluded, misclassification, lead time, missed changes, false positives, and calibration suggestions. It does not use price movement as proof, future evidence, or branch evidence to lift parent stages.

Manual evidence import runs before the pipeline:

- `data/imports/evidence_draft.example.yaml`
- `outputs/imports/evidence_validation_report.json`
- `outputs/imports/evidence_validation_report.md`
- `outputs/imports/evidence_import_report.json`
- `outputs/imports/evidence_import_report.md`
- `data/imports/accepted/<import_id>.yaml`
- `data/imports/rejected/<import_id>.yaml`
- `data/sample_evidence/manual_imported_evidence.yaml`
- `data/audit/evidence_import_audit.jsonl`

## Architecture Checklist

- Domain layer: pure Evidence, Topic/Branch, Stage Gate, Scoring, Reactivation, and Diff rules. It has no direct filesystem, YAML, CLI, or output-path dependency.
- Application layer: use cases orchestrate ImportEvidence, RunPipeline, BuildDiff, BuildWeeklyBrief, BuildOperatorReview, and weekly runs through repository and system contracts.
- Infrastructure layer: file-system adapters implement repositories, YAML loading, schema validation, atomic writing, run history, review persistence, and clock access.
- Interface layer: CLI commands call Application use cases and print summaries.
- Data repositories: YAML loaders for topics, evidence, golden cases, failure cases, evaluations, and seed memory.
- Evidence layer: structured Evidence Table rows with event metadata, affected layers, scope, branch coverage, interpretation, limitation, polarity, and confidence.
- Stage layer: Stage Gate rules run before scoring and produce `stage_snapshot`.
- Scoring layer: scores require evidence plus a matching Stage Classification; forged high-stage classifications are rejected.
- Parent/branch separation: parent dimensions use parent-scoped stage evidence; branch dimensions remain branch-scoped.
- Dashboard layer: cards include `why_not_higher_stage`, structured `key_events`, structured `key_branches`, `evidence_ids`, `score_id`, and `stage_snapshot`.
- Early Radar layer: old topics and branch mutations require a `reactivation_record_id`.
- Evaluation layer: failure cases are linked to monthly review results and corrective rules.
- Guardrail layer: generated outputs are schema-validated and tested for research-only behavior.
- Report layer: weekly briefs aggregate existing artifacts only; they do not reclassify, rescore, infer new evidence, or lift parent stages from branch evidence.
- Evidence import layer: manual drafts are validated, normalized, accepted or rejected, and audited before they can enter pipeline fixtures.
- Diff layer: current pipeline artifacts and previous snapshots are compared mechanically; display stage and Stage Gate stage remain distinct, and the layer cannot classify, score, infer evidence, or lift a parent from branch evidence.
- Report integration: weekly brief stage changes are a projection of canonical diff output. The report does not run stage comparisons itself.
- Historical review layer: operator reviews aggregate immutable run artifacts only and surface historical trends, repeated issues, guardrail regressions, consecutive `no_change` topics, and research-only next actions.
- Pilot layer: live research ledgers compare existing artifacts with manual operator observations, require competing hypotheses and falsification triggers, allow unchanged topics, and restrict actions to `observe`, `wait`, `validate`, `review`, `monitor`, and `flag_risk`.
- Replay layer: historical time slices use `available_at` to prevent future-evidence leakage and calibrate Stage, Diff, Early Radar, missed-change, false-positive, and parent/branch behavior.
- Operator guide layer: non-developer docs explain evidence intake, weekly review, change inspection, outcome recording, replay, and troubleshooting.
- Artifact contract layer: stable public artifacts carry `artifact_type`, `schema_version`, `producer_version`, `rule_version`, `run_id`, and `generated_at` metadata.
- Legacy service cleanup layer: `src/services` is now an inventoried compatibility surface; migrated rules live in Domain/Application/Infrastructure and remaining legacy-active services have documented target layers and reasons.

## Repository Contracts

The product core defines contracts for:

- `EvidenceRepository`
- `TopicRepository`
- `ArtifactRepository`
- `RunRepository`
- `HistoryRepository`
- `FailureCaseRepository`
- `ReviewRepository`
- `GoldenCaseRepository`

File-system implementations back the current local CLI. InMemory implementations support tests. PostgreSQL and database migrations are intentionally out of scope for v0.4.

Pilot I/O currently uses a file-system adapter for YAML inputs and JSON/Markdown artifacts. It remains outside database scope.

Replay I/O currently uses a file-system adapter for replay YAML inputs and JSON/Markdown artifacts. It remains outside database and automated-ingestion scope.

## Legacy Service Migration

v0.4.1 moved the following implementation groups out of `src/services`:

- Evidence import validation rules -> Domain.
- Evidence import normalization -> Application.
- Evidence import YAML/schema/file/audit I/O -> Infrastructure.
- Evidence Table, Stage Classification, Scoring, Stage Diff, Dashboard Card guardrails, Memory/Reactivation, Early Radar, Failure Case, Evaluation, and Versioning rules -> Domain.
- Run context -> Infrastructure.

Remaining legacy-active services are tracked in `docs/legacy_service_inventory.json`, with categories and migration targets. Compatibility wrappers remain under `src/services` for existing imports.

## Golden Case Results

- BCI: parent narrative remains `S4`; medical rehabilitation branch is tracked separately as `S5-S6`; branch validation cannot upgrade the parent.
- Humanoid robotics: dashboard baseline remains `S5-S6`; stage evidence supports S6 validation but S7 requires durability and friction monitoring.
- Innovative drug License-out: dashboard baseline remains `S5-S6`; deal-quality evidence supports pricing/reality validation, while milestone and regulatory realization remain explicit limits.

## Current Limits

- Evidence sources are local fixtures or manually imported drafts, not automated ingestion.
- Outputs are JSON artifacts, not a web dashboard.
- Data Confidence is rule-based from fixture metadata and should be expanded with real source-quality scoring before production use.
- Historical review is artifact-based and does not yet include database queries, UI filtering, or automated source ingestion.
- v0.4 rejects older unversioned public artifacts at schema boundaries unless an explicit migration is added.
- Some report, review, diff, and pipeline assembly code remains in inventoried legacy-active services pending the next cleanup slice.
- Pilot metrics such as stage-change precision and Early Radar follow-through are marked `insufficient_history` when the available run history cannot support calculation.
- The Pilot layer is not a UI, database, automated ingestion layer, source-quality model, or probability model.
- Replay fixtures are synthetic calibration cases. They validate rule behavior and time slicing, but they are not a substitute for the 4-6 week live pilot outcome review.
- Operator guides are Markdown docs, not an interactive product interface.

## Next Recommended Phase

Product roadmap:

1. v0.5.3 Pilot Iteration After 4-6 Weeks.
2. v0.6 Read-Only Operator Interface.
3. v0.7 PostgreSQL Adapter.
4. Automated ingestion only after source quality, provenance, pilot evaluation, and read-only review gates remain stable.
