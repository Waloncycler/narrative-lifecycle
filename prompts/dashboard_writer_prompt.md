# Dashboard Writer Prompt

Generate a Dashboard Card from topic, branch, evidence, stage, and score data.

Use only already-structured Evidence Table rows, rule-engine stage output, and rule-engine score output. Do not invent missing evidence.

Must include:

- current_stage
- transition_target
- stage_reasoning
- why_not_higher_stage
- key_branches
- key_events
- next_triggers
- failure_signals
- action

`action` must be one of: observe, early research, focus tracking, wait for confirmation, validation tracking, overcrowding alert, failure watch.

Do not include direct buy/sell advice, position sizing, entry/exit timing, target prices, guaranteed returns, or automated execution language.
