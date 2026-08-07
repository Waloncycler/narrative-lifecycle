# Controlled Autonomous Research Loop

## Purpose

This is the one live-research loop. It can find and organize new evidence, create a provisional topic, update a formal Evidence Table, and refresh the operational state. It is not a trading system and never produces buy/sell advice.

## Operating Flow

```text
source change
-> source-specific normalization
-> candidate evidence with source quote
-> Topic / Branch / Memory audit
-> publication policy
-> formal Evidence Table
-> Stage Gate
-> Score
-> operational Diff, Weekly, Review, Learning
```

The source parser and Agent create candidates. Only the deterministic policy can publish a candidate, and Stage is always evaluated from the resulting Evidence Table. A model cannot classify Stage, score, activate a Topic, modify Registry or rules, or lift a Parent with Branch evidence.

## Commands

```bash
# Inspect available governed source operations.
npm run sources:inventory

# Run one bounded source-to-artifact cycle. --operation is optional but useful
# when validating a particular source; --force rechecks the selected payload.
npm run agent:run -- --kind manual --operation DirectClinicalTrialsGovStudies --force

# Rebuild operational state without publishing a candidate.
npm run autonomy:run -- --no-publish

# Read operating history and pilot status.
npm run review
npm run pilot:review
```

## Publication Rules

Automatic publication is intentionally narrow. A record must have traceable provenance, a source URL, a permitted non-news source type, valid schema and quotation, valid Parent/Branch scope, sufficient strength/confidence, and no conflict or unsafe parent-stage jump. A deterministic primary/official record may use the `rule_verified` path when the model falls back. Everything else is held for review.

For manual evidence, a row is live only when its ID appears in `data/audit/operational_evidence_admission.jsonl`. The current controlled import path writes this admission record. Historical exploratory records and earlier bulk-import audits are not deleted; they remain available for revalidation and re-import, but cannot drive Stage Gates merely because they are in an old YAML table or an old audit log.

## Current Verified Result

The successful controlled ClinicalTrials.gov run created:

```text
Topic: provisional_innovative_drug_clinical_development
Evidence: 5 official, source-cited E3 trial records
Operational state: S2, medium Data Confidence
Why not higher: no stable label, capital confirmation, or pricing adoption
```

The latest source cycle completed with `MiniMax-M3` and `evidence-intake-agent-v0.7.1`: five model candidates passed quotation, Parent/Branch, E3/E4, and no-trading checks. Existing Evidence IDs were held as duplicates, so the rerun did not write duplicate formal evidence. The topic remains provisional. A researcher must explicitly review activation; evidence accumulated in a branch remains separate and can never upgrade the Parent.

## Artifacts

`outputs/operator_runs/` contains the current canonical live state and each successful per-run immutable manifest. `outputs/autonomy/` contains promotion decisions and compatibility/audit views. `outputs/reviews/` aggregates only the valid operator-run history. Golden Cases remain in the independent regression artifact chain.

With fewer than two valid operator runs, the review and pilot layers correctly return `insufficient_history` rather than inventing a trend.
