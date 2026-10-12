# Governed Active Learning

## Purpose

The Evidence Intake Agent improves from reviewed work without becoming an authority over Evidence, Stage, Score, Topic Registry, or import permission.

```text
human review
-> cumulative learning profile
-> active learning queue
-> improvement proposals
-> frozen-baseline shadow validation
-> human promotion review
-> versioned advisory context
```

## What Updates Automatically

- Reviewed field corrections, Topic/Branch corrections, rejection reasons, split decisions, duplicate hits, and guardrail incidents accumulate in the Learning Profile.
- The latest approved advisory profile is included in later Agent requests.
- Every completed Workbench import automatically builds an Intake Evaluation, Learning Profile, and Learning Cycle.
- High-information candidates move to the front of the review queue.

## Active Learning Priority

Candidate priority is diagnostic:

```text
P = 100 * (
  0.30 * uncertainty
  + 0.25 * rule_agent_disagreement
  + 0.20 * historical_error_density
  + 0.15 * novelty
  + 0.10 * stage_impact_risk
)
```

Parent/Branch and E3/E4 risks force a high-priority review band. The score never changes Stage or Evidence strength.

## Proposal Rules

A correction pattern remains `collecting` until it has at least three reviewed observations. It may then become `shadow_ready`. A proposal can only affect advisory prompt context and always requires human approval before any canonical rule or Registry change.

## Promotion Gates

An Agent version can only become `eligible_for_human_review` when:

- reviewed candidates >= 50
- citation accuracy >= 95%
- unsupported claim rate <= 2%
- Parent/Branch error rate <= 1%
- E3/E4 overstatement rate <= 2%
- no-trading-advice guardrail passes

Failing any gate produces `blocked`. Fewer than 50 reviewed candidates produces `insufficient_history`.

## Artifacts

```text
outputs/intake/latest_learning_profile.json
outputs/intake/latest_learning_cycle.json
outputs/intake/latest_learning_cycle.md
outputs/intake/latest_learning_proposals.json
outputs/intake/latest_active_learning_queue.json
outputs/intake/history/learning_cycle_*.json
```

All cycles are immutable in history. `rollback_profile_id` identifies the prior advisory profile. No API key is stored.

## Commands

```bash
npm run intake:apply -- --decisions outputs/intake/latest_review_decisions.yaml
npm run intake:learn -- --decisions outputs/intake/interactive_review_decisions.yaml
npm run intake:learning-cycle
```

`intake:apply` now runs evaluation and the learning cycle after the existing human-reviewed import workflow. It never creates unattended import permission.
