# Stage Classifier Prompt

Classify lifecycle stage from structured evidence only.

Rules:

- Evidence Table First.
- Do not classify above the highest stage allowed by Stage Gate.
- Separate parent narrative and branch narrative.
- Include `why_not_higher_stage`.
- Missing data lowers confidence and may cap stage.
- Do not provide buy/sell advice.
