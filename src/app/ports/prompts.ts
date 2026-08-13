// Auto-generated prompt exports

export const dashboard_writer_prompt = (args?: Record<string, any>) => `
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

\`action\` must be one of: observe, early research, focus tracking, wait for confirmation, validation tracking, overcrowding alert, failure watch.

Do not include direct buy/sell advice, position sizing, entry/exit timing, target prices, guaranteed returns, or automated execution language.

`;

export const early_radar_prompt = (args?: Record<string, any>) => `
# Early Radar Prompt

Determine if a candidate belongs in Early Radar.

Classify signal_origin:

- new_topic
- dormant_signal_reactivation
- stage_reactivation
- branch_mutation
- reality_catch_up
- expectation_reset
- repeated_old_story

Only S1-S4 candidates and S7C new branches should enter radar.

Old themes must pass Narrative Memory lookup and Reactivation Service classification before Early Radar admission. Repeated old stories do not enter unless rule-based Narrative Delta is material.

`;

export const evidence_extraction_prompt = (args?: Record<string, any>) => `
# Evidence Extraction Prompt

Extract structured evidence from raw text.

Evidence Table First. Return atomic evidence rows before any interpretation. Do not classify the topic stage and do not score the topic.

Return:

- event_date
- event_title
- event_summary
- event_type
- source_name
- source_type
- affected_layer
- evidence_strength
- stage_effect
- parent_or_branch
- branch_id if applicable
- interpretation
- limitation
- confidence

Use controlled labels for \`evidence_strength\`, \`stage_effect\`, and \`confidence\`; include the raw basis for each label in \`interpretation\` and the uncertainty in \`limitation\`.

Do not score the topic directly. Do not bypass stage gates.

`;

export const failure_case_prompt = (args?: Record<string, any>) => `
# Failure Case Prompt

Analyze a failure case.

Return:

- peak_stage
- failed_transition
- failure_type
- false_positive_signals
- missed_warning_signals
- corrective_rules
- lessons_for_model

`;

export const reactivation_prompt = (args?: Record<string, any>) => `
# Reactivation Prompt

Compare new event with Narrative Memory.

Do not calculate Narrative Delta Score directly. Return rule-engine inputs only; the Reactivation Service computes the final score and radar decision.

Return:

- previous_peak_stage
- previous_failed_transition
- previous_missing_evidence
- new_evidence
- missing_evidence_filled
- reactivation_type
- new_evidence_quality_input
- stage_gate_impact_input
- branch_mutation_strength_input
- expectation_reset_input
- data_confidence_input
- old_story_repetition_risk

Repeated old stories should not enter Early Radar unless the rule engine detects material Narrative Delta.

`;

export const scoring_prompt = (args?: Record<string, any>) => `
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

`;

export const stage_classifier_prompt = (args?: Record<string, any>) => `
# Stage Classifier Prompt

Classify lifecycle stage from structured evidence only.

Rules:

- Evidence Table First.
- Do not classify above the highest stage allowed by Stage Gate.
- Separate parent narrative and branch narrative.
- Include \`why_not_higher_stage\`.
- Missing data lowers confidence and may cap stage.
- Do not provide buy/sell advice.

`;

