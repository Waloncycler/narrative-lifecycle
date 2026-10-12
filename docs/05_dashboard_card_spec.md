# 05 Dashboard Card Spec

## Required Fields

- `card_id`
- `topic_id`
- `topic_name`
- `as_of_date`
- `current_stage`
- `transition_target`
- `stage_confidence`
- `stage_reasoning`
- `why_not_lower_stage`
- `why_not_higher_stage`
- `parent_narrative`
- `key_branches`
- `key_events`
- `scores`
- `next_triggers`
- `failure_signals`
- `action`
- `review_window`
- `data_confidence`
- `rule_version`

## Required Reasoning

Every card must explain:

1. Why this stage.
2. Why not lower.
3. Why not higher.
4. What evidence is missing for upgrade.
5. Which branch evidence does or does not represent the parent narrative.

## Allowed Actions

Use research actions only:

- observe
- early research
- focus tracking
- wait for confirmation
- validation tracking
- overcrowding alert
- failure watch

Do not output buy/sell instructions.
