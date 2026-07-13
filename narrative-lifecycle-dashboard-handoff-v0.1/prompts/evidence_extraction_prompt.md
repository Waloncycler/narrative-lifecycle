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

Use controlled labels for `evidence_strength`, `stage_effect`, and `confidence`; include the raw basis for each label in `interpretation` and the uncertainty in `limitation`.

Do not score the topic directly. Do not bypass stage gates.
