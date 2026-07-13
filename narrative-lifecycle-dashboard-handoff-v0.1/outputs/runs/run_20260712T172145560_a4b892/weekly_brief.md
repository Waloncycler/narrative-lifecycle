# Weekly Narrative Lifecycle Brief

## 1. Executive Summary

- report_id: weekly_brief_run_20260712T172145560_a4b892
- generated_at: 2026-07-12T17:21:45.560Z
- rule_version: narrative-lifecycle-rules-v0.1
- dashboard_card_count: 3
- score_count: 3
- golden_case_passed: 3
- golden_case_total: 3
- early_radar_candidate_count: 1
- system_status: ok

## 2. Stage Snapshot

- 脑机接口 BCI (bci)
  - current_stage: S4
  - parent_narrative: 脑机接口 BCI
  - strongest_branch: bci medical rehab (S5-S6)
  - weakest_layer: policy_perception
  - data_confidence: 74
- 人形机器人 / 具身智能 (humanoid_robotics)
  - current_stage: S5-S6
  - parent_narrative: 人形机器人 / 具身智能
  - strongest_branch: robot actuator (S5-S6)
  - weakest_layer: policy_perception
  - data_confidence: 70
- 创新药 License-out (innovative_drug_license_out)
  - current_stage: S5-S6
  - parent_narrative: 创新药 License-out
  - strongest_branch: adc license out (S5-S6)
  - weakest_layer: policy_perception
  - data_confidence: 70

## 3. Stage Changes

- previous_snapshot_id: stage_snapshot_run_20260712T172137443_0d28be
- current_snapshot_id: stage_snapshot_run_20260712T172145560_a4b892
No narrative state changes detected compared with stage_snapshot_run_20260712T172137443_0d28be.

### Upgrades
- none
### Downgrades
- none
### Evidence Added Without Stage Change
- none
### Why Not Higher Changes
- none
### Data Confidence Changes
- none
### Branch Mutation Candidates
- none
### Guardrail Regressions
- none

## 4. Strongest Evidence

- bci_parent_label: 脑机接口 BCI; strength=score_74; layer=perception; interpretation=Supports parent narrative label stability.
- bci_parent_capital: 脑机接口 BCI; strength=score_74; layer=perception; interpretation=Supports S4 capital confirmation for the parent narrative.
- humanoid_parent_pricing: 人形机器人 / 具身智能; strength=score_70; layer=pricing; interpretation=Supports pricing adoption for the parent narrative.
- humanoid_e001: 人形机器人 / 具身智能; strength=score_70; layer=reality; interpretation=Supports reality validation in a core branch.
- licenseout_parent_pricing: 创新药 License-out; strength=score_70; layer=pricing; interpretation=Supports pricing adoption through deal structure.
- licenseout_e001: 创新药 License-out; strength=score_70; layer=reality; interpretation=Supports reality-first path and pricing adoption.

## 5. Why Not Higher

- 脑机接口 BCI (S4)
  - why_not_higher_stage: Upgrade is capped by required checks: old theme reactivation; branch reality upgrade; pricing adoption insufficient; parent reality insufficient; medical branch validation cannot represent whole BCI; revenue/payment/listed-asset mapping still missing.
  - evidence_ids: bci_parent_label, bci_parent_capital, bci_branch_label_pricing, bci_e001, import_bci_medical_rehab_followup_001
- 人形机器人 / 具身智能 (S5-S6)
  - why_not_higher_stage: Upgrade is capped by required checks: pricing adoption; reality validation; valuation friction; S7A/S7C potential; S7B risk for crowded edge assets.
  - evidence_ids: humanoid_parent_label, humanoid_parent_capital, humanoid_parent_pricing, humanoid_parent_reality, humanoid_e001
- 创新药 License-out (S5-S6)
  - why_not_higher_stage: Upgrade is capped by required checks: reality-first path; pricing adoption through upfront/milestone/global rights; clinical and regulatory risk; milestone realization risk.
  - evidence_ids: licenseout_parent_label, licenseout_parent_capital, licenseout_parent_pricing, licenseout_parent_reality, licenseout_e001

## 6. Early Radar Candidates

- 脑机接口 BCI
  - candidate_id: radar_bci
  - reason: Old theme reactivation has new branch reality evidence, but parent gates remain incomplete.
  - reactivation_record_id: reactivation_bci_S4
  - evidence_ids: bci_parent_label, bci_parent_capital, bci_branch_label_pricing, bci_e001, import_bci_medical_rehab_followup_001
  - research_only_action: early research

## 7. Guardrail Check

- no_trading_advice: true
- research_only_actions: true
- parent_branch_separation_preserved: true
- evidence_ids_visible: true
- why_not_higher_present: true
- data_confidence_present: true

## 8. Next Operator Actions

- request_more_evidence: bci; reason=Missing pricing adoption; Missing hard reality evidence.; evidence_ids=bci_parent_label, bci_parent_capital
- monitor: humanoid_robotics; reason=S6 is not safety; monitor continuity, friction, and S7 branch outcomes.; evidence_ids=humanoid_parent_label, humanoid_parent_capital, humanoid_parent_pricing, humanoid_parent_reality
- monitor: innovative_drug_license_out; reason=S6 is not safety; monitor continuity, friction, and S7 branch outcomes.; evidence_ids=licenseout_parent_label, licenseout_parent_capital, licenseout_parent_pricing, licenseout_parent_reality
- track: bci; reason=Old theme reactivation has new branch reality evidence, but parent gates remain incomplete.; evidence_ids=bci_parent_label, bci_parent_capital, bci_branch_label_pricing, bci_e001, import_bci_medical_rehab_followup_001

## 9. Artifact Index

- outputs/dashboard_cards/bci.json
- outputs/dashboard_cards/humanoid_robotics.json
- outputs/dashboard_cards/innovative_drug_license_out.json
- outputs/scores/bci.json
- outputs/scores/humanoid_robotics.json
- outputs/scores/innovative_drug_license_out.json
- outputs/golden_case_results.json
- outputs/early_radar_candidates.json
- outputs/evaluation_summary.json
- outputs/system_summary.json

