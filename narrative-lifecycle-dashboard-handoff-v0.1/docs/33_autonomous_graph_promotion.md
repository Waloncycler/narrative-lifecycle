# Autonomous Graph Promotion

## Purpose

This module completes the autonomous research loop after discovery. It lets
the system turn a source-grounded `provisional` Topic or `watch` Branch into
an `active` registry node without a manual YAML edit, but only after formal
Evidence has accumulated under a versioned policy.

This is a registry-visibility decision, not a lifecycle judgment. The Stage
Gate still reads only the Evidence Table, runs before Score, and records its
own `why_not_higher_stage` result.

## Automatic Loop

```text
scheduled source sync
-> source-quoted candidate + Topic/Branch discovery
-> provisional Topic / watch Branch registration
-> Validator + duplicate + provenance + publication policy
-> formal Evidence Table
-> independent-source graph promotion
-> deterministic snapshot, Diff, Weekly Brief, Review
```

## Default Promotion Policy

`configs/autonomous_research_policy.json` enables the current conservative
policy:

- A provisional Topic needs two independent, eligible **parent-scope** formal
  Evidence sources before it becomes active.
- A watch Branch, including a source-named molecule, product, SKU, or asset,
  needs two independent, eligible **branch-scope** formal Evidence sources.
- Evidence must have a URL, approved source type, E2 or above, and high data
  confidence. News is not automatically published in the default policy.
- Negative or downgrade evidence holds the transition. A lack of evidence is a
  valid hold, not an error.

## Parent, Branch, And Asset Isolation

A named molecular asset such as `RC148` is registered as a watch Branch under
its resolved parent. Its evidence accumulates on that Branch only. Activating
the asset Branch does not activate, score, or lift the parent Topic.

Likewise, branch-only evidence cannot activate a provisional parent because
the parent policy requires parent-scope formal Evidence. Every promotion report
states this guardrail explicitly.

## Audit Artifacts

Each autonomous run writes:

- `outputs/autonomy/latest_narrative_graph_promotion.json`
- `outputs/autonomy/latest_narrative_graph_promotion.md`
- `outputs/autonomy/history/narrative_graph_promotion_<run_id>.json`
- `data/audit/narrative_graph_promotion.jsonl` for transitions actually
  applied to the file-backed registry.

The report records the old and new registry status, supporting Evidence IDs,
independent source count, hold reasons, and guardrail checks. Registry writes
are idempotent: a later run cannot repeat the same activation.

## Boundaries

- Models may suggest facts, mappings, and source-named assets, but cannot set
  a Stage, Score, policy threshold, registry status, or rule.
- No Evidence Table means no automatic promotion.
- Narrative Memory still runs before a revived theme is treated as new.
- The system does not produce trading advice or automated execution.
- Autonomous coverage is limited to configured, governed sources. Adding a new
  source connector requires its own provenance and governance contract.
