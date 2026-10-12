# 29 Timeline Credibility

## Purpose

The stage timeline is an evidence replay. It is not a generated story and it
must not turn a late discovery of a mature topic into a fictional S0-to-S6
journey.

## Canonical rebuild

```bash
npm run timeline:rebuild
```

This command reads only operationally admitted Evidence Table rows and writes
the topic timeline artifact. It never changes the Evidence Table, Topic
Registry, Stage rules, or historical run artifacts.

## What can move a timeline

A parent-scope row must have all of the following before it can contribute to
the reconstructed path:

- a source URL;
- an event summary;
- an interpretation;
- a limitation;
- valid `event_date` and `available_at` values;
- no `historical_backfill` marker.

Branch, asset, and unknown-scope evidence cannot move the parent timeline.

## Honest gaps

When the available evidence moves from one observed stage to a later stage
without independently dated material for the middle stages, the UI shows a
**historical evidence gap**. It does not draw invented S3, S4, or S5 events.

This commonly means one of two things:

1. the system first discovered an already mature topic; or
2. prior evidence exists but still needs source retrieval and review.

The next action is to collect and import source-backed historical evidence,
not to edit a stage or timeline by hand.

## Retired paths

Legacy scripts that directly wrote stage snapshots or evolution artifacts are
retired. Search, scraping, AI analysis, and historical lookup may produce
candidates only. The permitted path is:

```text
source -> candidate -> human review -> Evidence import -> deterministic stage rebuild -> timeline rebuild
```

The system remains research-only and does not generate trading advice.
