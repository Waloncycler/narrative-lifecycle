# 28 Evidence Publication Governance

## Purpose

Research discovery may be automated; formal Evidence admission must remain explainable, deterministic and reversible. This policy prevents a useful research agent from silently becoming an authority over Topic state, Stage or Score.

## Two Explicit Modes

| Mode | Normal callers | Result |
| --- | --- | --- |
| `review_required` | Workbench, `agent:run`, scheduler, `autonomy:run` | Candidate and source package are written; `agent:run` / scheduler / `autonomy:run` also write a policy result. Evidence Table and graph registry remain unchanged. |
| `policy_auto` | `autonomy:run -- --publish-auto` with policy enabled | A candidate may be admitted only after all publication gates pass. |

The default policy is review-first. Changing it is a governed configuration change and should be reviewed in version control.

## Required Gates for `policy_auto`

1. Explicit command request and `auto_publish_evidence=true`.
2. Resolved Topic/Branch identity; unresolved mappings are held.
3. Source URL, provenance record, quote and quote location.
4. Schema validation, duplicate detection, supported-fact and no-trading-language checks.
5. Allowed source class, E0-E4 minimum and Data Confidence minimum.
6. Parent/Branch protection and conflicting-evidence hold.
7. Prospective parent-stage jump ceiling.

Topic and Branch activation have a second, independent graph gate: verified market name and enough independent formal sources. A branch never upgrades its parent Stage.

## Source Retrieval Contract

Fetched pages remain `context_only`. A retrieval item is marked `ready` only when it contains enough readable text and at least one meaningful, offset-addressable quote. An `insufficient` item is held for more source material; it must not be converted into Evidence just because the HTTP request succeeded.

## Audit Artifacts

```text
outputs/autonomy/latest_promotion_report.json
outputs/autonomy/latest_narrative_graph_promotion.json
outputs/research/latest_source_retrieval.json
outputs/research_agent/latest_run.json
```

The promotion report records publication mode, whether publication was requested, every held/rejected reason and the guardrail state. The Narrative Monitor turns held items into `待发布证据复核` tasks.

`publication_mode` and the extended publication guardrails are additive fields on the stable `1.0.0` report contract. Readers must treat them as absent for historical reports created before v0.14 and interpret those reports using their recorded policy and decisions.

## Policy Audit

Before enabling controlled publication, run:

```bash
npm run policy:validate
```

The audit checks the configured evidence-strength and confidence floors, source URL and provenance requirements, model validation, news exclusion, conflict holds and Parent/Branch protection. It writes an audit artifact under `outputs/governance/`; it does not publish Evidence or change any lifecycle state.

## Non-Negotiable Boundaries

- No Evidence Table, no Stage or Score.
- Stage First, Score Second.
- Search hits and LLM output are never Evidence by themselves.
- Parent and Branch are independently scoped.
- No buy/sell, position, target-price or execution advice.
