# Source Change and Research Loop

## Purpose

The source layer should create review work only when a source fact is new or materially revised. Repeated snapshots, expired feed windows, and failed sources must not create duplicate Evidence, false removals, or automatic Stage changes.

## Closed Loop

```text
Source Sync
→ Normalized Fact State
→ Change Ledger
→ Intake Session
→ Topic Audit
→ Human Review
→ Evidence Import
→ Weekly Run
→ Stage Diff / Why Not Higher
```

The artifact chain is linked by `sync_id`, `fact_state_id`, `session_id`, `topic_audit_id`, `import_id`, accepted Evidence IDs, and `weekly_run_id`. The UI does not combine artifacts whose identifiers do not match.

## Change Semantics

- `new`: stable fact identity was not present in the previous state.
- `updated`: identity is stable but normalized semantic content changed.
- `unchanged`: identity and semantic fingerprint are unchanged; do not queue.
- `not_observed`: a previously observed fact is absent from a source that is allowed to assert absence. This is an observation state, never Evidence.

Current public feeds are sliding, active, top-N, or time-series windows. Their `absence_assertion_allowed` value is therefore false until pagination, window completeness, and source-specific expiry rules are implemented.

## State Rules

- Fact identity uses `operation_id` plus upstream record ID.
- Anonymous facts use a deterministic identity fingerprint.
- Semantic fingerprints exclude fetch time and record ordering.
- Failed, stale, degraded, partial, or unpolled sources cannot imply removal.
- Raw payloads remain transient; Fact State stores normalized facts, bounded metrics, URLs, normalizer versions, and fingerprints.

## Source Materiality

Every semantic revision remains in the Change Ledger. Revised records carry `actionable`, `materiality_policy`, `materiality_reason`, and field-level metric deltas. Below-threshold changes are auditable but do not create Intake work.

Current policies cover USGS magnitude/significance/tsunami revisions, GDACS alert/severity revisions, NWS severity/urgency/certainty revisions, and revision thresholds for Treasury, CFTC, and World Bank metrics. New facts remain visible to human reviewers. Uncalibrated sources use conservative review routing.

Materiality means only “worth human review.” It does not make a record Evidence, resolve Topic/Branch, assign E0-E4, classify Stage, or score a narrative.

## Pipeline Recovery

If Import succeeds and Weekly fails, Apply records `imported_pipeline_failed`. The recovery use case reruns Weekly only, preserving the original `import_id` and accepted Evidence IDs. It never performs a second import. Each recovery state is written to immutable Intake history.
- `new` and `updated` may create unresolved E1 candidates.
- `unchanged` and `not_observed` cannot create candidates.

## Import and Weekly Safety

- Manual Evidence persistence merges by `evidence_id`; later imports cannot erase unrelated prior Evidence.
- Apply requires the current `session_id` and a matching Topic Audit.
- Apply artifacts record Topic Audit, accepted Evidence IDs, Import ID, and Weekly Run ID.
- If import succeeds but Weekly fails, the result is persisted as `imported_pipeline_failed` for operator recovery.
- Parent/Branch separation, Evidence Table validation, Stage First, Score Second, and research-only actions remain mandatory.

## Operator States

The Sources page shows:

```text
发现变化 → 等待审核 → 已导入 Evidence → Weekly → 结果
```

`no_changes` is a valid completed state. The system does not force an action when no source fact changed.
