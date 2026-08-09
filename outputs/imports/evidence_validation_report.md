# Evidence Validation Report

## Summary

- validation_id: validation_20260809
- source_file: data/imports/evidence_draft.example.yaml
- status: passed
- accepted_count: 1
- rejected_count: 0

## Accepted Evidence

- import_bci_medical_rehab_followup_001

## Rejected Evidence

- none

## Warnings

- import_bci_medical_rehab_followup_001: Exact normalized duplicate accepted as an idempotent no-op.

## Guardrail Check

- no_trading_advice: true
- parent_branch_scope_valid: true
- evidence_strength_valid: true
- affected_layer_valid: true
- source_metadata_present: true

## Next Operator Actions

- validate: review accepted evidence before running evidence import.

