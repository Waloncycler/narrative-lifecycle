# Scoring Evidence Rubric Prompt

Prepare scoring inputs from structured evidence only.

Do not output numeric scores. The rule-based Scoring Engine computes numeric scores after Stage Gate classification.

For each scoring dimension, return:

- evidence_ids
- evidence summary
- reasoning
- missing_data
- confidence_basis

Required dimensions:

- policy_perception
- market_perception
- trading_perception
- capital_confirmation
- pricing_adoption
- parent_reality
- branch_reality
- branch_coverage
- feedback
- execution_friction
- valuation_friction
- data_confidence
- transition_probability
- narrative_delta_score inputs only

Do not output naked scores. Do not bypass Evidence Table First or Stage First, Score Second.
