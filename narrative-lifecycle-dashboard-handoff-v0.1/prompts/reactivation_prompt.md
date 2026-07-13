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
