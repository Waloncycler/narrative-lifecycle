# Self-Iterating Agent Loop

## Purpose

The research Agent can now improve the intake and knowledge-maintenance workflow without directly changing formal research state. It reads current context, decomposes new material, proposes new Topic/Branch mappings, proposes Evidence Chain relations, records review feedback, and uses approved feedback as advisory context for later runs.

This is a governed proposal loop, not unattended autonomy.

## Closed Loop

```text
source material
  -> rule candidates
  -> Agent candidates and independent facts
  -> Registry / Narrative Memory / Evidence Table / Diff context
  -> Topic Discovery Proposal
  -> Evidence Chain Entry
  -> human review
  -> existing Validator / Import / Weekly
  -> review feedback and Learning Profile
  -> advisory context for the next Agent run
```

The loop is idempotent by document, provenance, evidence, topic, and branch identity. Existing Evidence IDs are used as the only valid targets for model-suggested chain links.

## What The Agent May Do

- Extract several independent source-supported facts.
- Preserve exact quotes, offsets, provenance, limitations, and uncertainty.
- Suggest an existing Topic, alias, new Branch, reactivation, provisional Topic, or unresolved state.
- Suggest `supports`, `contradicts`, `updates`, `duplicates`, `branch_only`, or `fills_gap`.
- Generate pending Topic Discovery Proposals and candidate Evidence Chain Entries.
- Prioritize review using uncertainty, disagreement, novelty, and Parent/Branch risk.
- Learn from accepted, modified, rejected, and split candidate feedback as advisory context.

## What The Agent May Not Do

- Import formal Evidence without a human decision.
- Activate a Topic or promote a provisional Topic.
- Upgrade or downgrade a Stage, run scoring, or alter `why_not_higher_stage`.
- Use Branch Evidence as Parent Evidence.
- Rewrite Topic Registry, Narrative Memory, Stage Gates, scoring, or rules.
- Treat a missing source observation as negative evidence.
- Output buy/sell, target price, position, entry, exit, or execution advice.

## Artifacts

- `outputs/intake/latest_topic_discovery_proposals.json`
- `outputs/intake/latest_topic_discovery_proposals.md`
- `outputs/intake/latest_evidence_chain.json`
- `outputs/intake/latest_evidence_chain.md`
- `outputs/intake/history/topic_proposals_<timestamp>.json`
- `outputs/intake/history/evidence_chain_<timestamp>.json`

Proposals are `pending` until a researcher decides. Chain entries are `candidate` until the corresponding Evidence passes the existing review, duplicate, schema, Parent/Branch, and import gates.

## Context Contract

The Agent request may contain:

- canonical Topics, aliases, Branches, current stages, and Narrative Memory IDs;
- the latest Evidence Table context, including scope, strength, affected layers, polarity, and availability date;
- the latest canonical Diff, including evidence additions/removals, changes, branches, and `why_not_higher_stage`;
- the advisory Learning Profile and active-learning priorities.

The model can propose a relation, but the Domain layer verifies the target Evidence ID against the local Evidence Table and discards ungrounded IDs.

## Promotion Policy

The system may automatically refresh proposal artifacts and learning context. It may not automatically promote those proposals into formal Topic Registry, Evidence, Stage, Score, or rules. Promotion requires a human decision, a versioned audit record, schema validation, and the existing weekly pipeline.

## Verification Checklist

1. Run `npm run intake:agent -- --text "..."`.
2. Inspect the topic proposal and evidence-chain artifacts.
3. Open `/queue` and confirm proposals are marked as pending review.
4. Confirm no formal Evidence was imported before review.
5. Submit explicit human decisions through `/intake` or `intake:apply`.
6. Run `npm run topic:validate`, `npm run weekly`, and `npm run intake:learning-cycle`.
7. Check that Parent stage, Branch stage, Data Confidence, and `why_not_higher_stage` remain governed by the existing Domain pipeline.

