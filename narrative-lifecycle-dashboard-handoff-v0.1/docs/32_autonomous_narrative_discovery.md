# Autonomous Narrative Discovery

## Purpose

The Narrative Discovery layer turns source-grounded candidate facts into a
maintained Topic/Branch graph. It is cross-industry: it does not require a
separate hard-coded taxonomy for every sector.

```text
source quote
-> rule and model candidate
-> parent match (registry, aliases, Narrative Memory, lexical evidence)
-> distinct subtopic / branch extraction
-> duplicate and generic-label rejection
-> provisional Topic or watch Branch registration
-> existing Topic Resolver audit and research queue
-> reviewed Evidence / feedback / later discovery runs
```

## What It Detects

- Existing branches, including close label matches.
- New branches under a known parent when the source identifies a concrete
  application, mechanism, indication, user, geography, value-chain link,
  product form, or scenario.
- New provisional Topics when a structured, source-grounded direction is not
  in the registry. A provider may omit the `provisional_` prefix; the Domain
  layer normalizes it rather than losing it as unresolved.
- Narrative Memory reactivation before treating an old theme as new.
- Unresolved material when the parent relationship or branch label is broad,
  ambiguous, duplicate, or unsupported.

The label filter rejects generic phrases such as "broad scope" / "范围广泛".
It creates no branch from a merely parent-level statement.

## Safety Contract

- Every record retains candidate ID, raw-document ID, provenance ID, and exact
  source quote.
- A new branch is registered only as `watch`; a new Topic is `provisional` at
  `S0`. Neither is an active Topic promotion.
- Branch mappings are rewritten as `scope: branch` and `stage_effect:
  split_branch`. They cannot contribute parent Evidence or raise a parent
  Stage.
- The discovery layer does not classify Stage, score, import Evidence, modify
  rules, activate Topics, or produce trading advice.
- Formal Evidence still passes the existing Schema Validator, duplicate check,
  Parent/Branch guardrail, publication policy, Evidence Table, and Stage Gate.

## Artifacts

```text
outputs/intake/latest_narrative_discovery.json
outputs/intake/latest_narrative_discovery.md
outputs/intake/narrative_discovery_ledger.json
outputs/intake/history/narrative_discovery_*.json
```

The ledger retains distinct source documents for the same discovered node, so
later runs accumulate support without duplicating a rerun. The existing
`latest_topic_discovery_proposals.json` remains the operator-facing review
queue and is populated from the same resolver audit.

## Run

```bash
npm run intake:agent -- --text "paste research material"
# or the full governed source-to-artifact loop
npm run agent:run -- --kind manual --force
```

Inspect `latest_narrative_discovery.json`, then use the existing review and
import workflow. A model timeout or invalid response falls back to the rule
candidate path; the graph guardrails still run.
