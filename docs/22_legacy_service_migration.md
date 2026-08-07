# Legacy Service Migration

## v0.4.1 Scope

The cleanup goal is to shrink `src/services/*` by moving implementation code into the v0.4 layers while preserving public imports, CLI commands, artifacts, schemas, and semantic results.

Migration categories:

- `domain_rule`: pure business rules that belong in `src/domain`.
- `application_orchestration`: use-case or artifact assembly logic that belongs in `src/application`.
- `infrastructure_io`: file, YAML, JSON schema, path, clock, or atomic-write concerns that belong in `src/infrastructure`.
- `renderer`: Markdown/view rendering logic that belongs near the Interface layer.
- `deprecated`: compatibility wrapper around a migrated implementation.

The machine-readable inventory is `docs/legacy_service_inventory.json`; tests require every service file to appear there.

## Migrated In v0.4.1

- Evidence import validation rules moved to `src/domain/evidence_import_rules.ts`.
- Evidence import normalization moved to `src/application/evidence_import_normalizer.ts`.
- Evidence import loading, schema adaptation, writing, and audit logging moved to `src/infrastructure/evidence_import_io.ts`.
- Evidence table guards moved to `src/domain/evidence_table.ts`.
- Stage classification moved to `src/domain/stage_classifier.ts`.
- Scoring engine moved to `src/domain/scoring_engine.ts`.
- Stage diff engine moved to `src/domain/stage_diff_engine.ts`.
- Memory lookup moved to `src/domain/memory_service.ts`.
- Reactivation record creation moved to `src/domain/reactivation_service.ts`.
- Early Radar rules moved to `src/domain/early_radar_service.ts`.
- Dashboard card guardrails moved to `src/domain/dashboard_card_service.ts`.
- Versioning helpers moved to `src/domain/versioning_service.ts`.
- Run context creation and environment mapping moved to `src/infrastructure/run_context.ts`.
- Failure-case validation and trap classification moved to `src/domain/failure_case_service.ts`.
- Evaluation calibration moved to `src/domain/evaluation_service.ts`.

## Remaining Legacy Files

The remaining `legacy_active` services are intentionally retained because they still combine several responsibilities or render public artifacts. They are explicitly tracked in `docs/legacy_service_inventory.json` and should be migrated in this order:

1. Pipeline and golden-case orchestration.
2. Diff/report/review artifact loaders and writers.
3. Markdown renderers into an Interface renderer package.
4. Run context and atomic writer into Infrastructure-only entry points.

## Compatibility Rule

Compatibility wrappers under `src/services` may re-export migrated implementations, but they should not regain business logic or file I/O. New code should import from `src/domain`, `src/application`, or `src/infrastructure` directly.
