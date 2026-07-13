# Historical Narrative Replay

## 1. Replay Window

- ledger_id: replay_ledger_run_20260713T035113631_508dfa
- run_id: run_20260713T035113631_508dfa
- generated_at: 2026-07-13T03:51:22.971Z
- status: ok
- case_count: 5

## 2. Aggregate Results

- success_count: 2
- failure_count: 1
- misclassification_count: 1
- missed_change_count: 0
- false_positive_count: 1
- average_lead_time_days: 51
- parent_branch_separation_preserved: true

## 3. Case Results

- replay_ai_edge_success
  - topic_id: ai_edge_applications
  - scenario_type: success
  - final_stage_before_outcome: S6
  - correct_stage: S6
  - outcome_status: confirmed
  - misclassification: false
  - lead_time_days: 73
  - missed_change: false
  - false_positive: false
  - calibration_suggestion: Keep E4 multi-customer replication as the required S6 confirmation point.
  - T0 as_of 2026-02-01: parent S3; evidence replay_ai_edge_label; future_excluded replay_ai_edge_capital_pricing, replay_ai_edge_reality; radar radar_replay_ai_edge_success_S3
  - T1 as_of 2026-02-15: parent S5; evidence replay_ai_edge_capital_pricing, replay_ai_edge_label; future_excluded replay_ai_edge_reality; radar none
  - T2 as_of 2026-03-15: parent S6; evidence replay_ai_edge_capital_pricing, replay_ai_edge_label, replay_ai_edge_reality; future_excluded none; radar none
- replay_metaverse_failure
  - topic_id: consumer_metaverse
  - scenario_type: failure
  - final_stage_before_outcome: S5
  - correct_stage: S3
  - outcome_status: falsified
  - misclassification: true
  - lead_time_days: 50
  - missed_change: false
  - false_positive: true
  - calibration_suggestion: Add stricter downgrade pressure when pricing language lacks reality evidence across the validation window.
  - T0 as_of 2026-01-10: parent S3; evidence replay_meta_label; future_excluded replay_meta_capital_pricing; radar radar_replay_metaverse_failure_S3
  - T1 as_of 2026-01-25: parent S5; evidence replay_meta_capital_pricing, replay_meta_label; future_excluded none; radar none
- replay_policy_s7b
  - topic_id: industrial_policy_cycle
  - scenario_type: s7b
  - final_stage_before_outcome: S7B
  - correct_stage: S7B
  - outcome_status: weakened
  - misclassification: false
  - lead_time_days: 30
  - missed_change: false
  - false_positive: false
  - calibration_suggestion: Keep S7B separate from early opportunity logic and surface it as a risk-state classification.
  - T0 as_of 2026-04-01: parent S5; evidence replay_policy_label_capital_pricing; future_excluded replay_policy_saturation; radar none
  - T1 as_of 2026-04-20: parent S7B; evidence replay_policy_label_capital_pricing, replay_policy_saturation; future_excluded none; radar none
- replay_bci_s7c_branch
  - topic_id: bci
  - scenario_type: s7c
  - final_stage_before_outcome: S4
  - correct_stage: S4
  - outcome_status: confirmed
  - misclassification: false
  - lead_time_days: 50
  - missed_change: false
  - false_positive: false
  - calibration_suggestion: Preserve parent and branch separation; never lift parent BCI to S7C from branch evidence.
  - T0 as_of 2026-05-01: parent S4; evidence replay_bci_parent_label_capital; future_excluded replay_bci_branch_s7c; radar radar_replay_bci_s7c_branch_S4
  - T1 as_of 2026-05-25: parent S4; evidence replay_bci_branch_s7c, replay_bci_parent_label_capital; future_excluded none; radar radar_replay_bci_s7c_branch_S4, radar_replay_bci_s7c_branch_bci_medical_rehab
- replay_industrial_iot_no_change
  - topic_id: industrial_iot
  - scenario_type: long_no_change
  - final_stage_before_outcome: S4
  - correct_stage: S4
  - outcome_status: no_change
  - misclassification: false
  - lead_time_days: not_applicable
  - missed_change: false
  - false_positive: false
  - calibration_suggestion: Treat long no-change as valid and avoid forced action generation.
  - T0 as_of 2026-02-01: parent S4; evidence replay_iot_label_capital; future_excluded none; radar radar_replay_industrial_iot_no_change_S4
  - T1 as_of 2026-03-01: parent S4; evidence replay_iot_label_capital; future_excluded none; radar radar_replay_industrial_iot_no_change_S4
  - T2 as_of 2026-04-01: parent S4; evidence replay_iot_label_capital; future_excluded none; radar radar_replay_industrial_iot_no_change_S4

## 4. Guardrails

- no_future_evidence_used: true
- no_trading_advice: true
- no_price_based_outcome_inference: true
- parent_branch_separation_preserved: true

## 5. Source Artifacts

- data/replay/replay_cases.yaml
- outputs/runs/latest_run.json

