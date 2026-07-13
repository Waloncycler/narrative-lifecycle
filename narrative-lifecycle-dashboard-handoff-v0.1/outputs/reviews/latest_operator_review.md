# Historical Operator Review

## 1. Review Window

- review_id: operator_review_run_20260713T032841770_1f2f1f
- generated_at: 2026-07-13T03:28:59.404Z
- status: ok
- first_run_id: run_20260711T120227457_6350c6
- last_run_id: run_20260713T032841770_1f2f1f
- run_count: 21
- successful_run_count: 21
- failed_run_count: 0

## 2. Stage Upgrade/Downgrade Trends

### Upgrades
- none
### Downgrades
- none

## 3. Evidence Added/Removed Trends

### Added
- none
### Removed
- none

## 4. Why Not Higher And Data Confidence

### Why Not Higher Changes
- none
### Data Confidence Changes
- none

## 5. Branch Mutation And Early Radar

### Branch Mutation Candidates
- none
### Early Radar Changes
- none

## 6. Guardrail Regression History

- run_20260711T120227457_6350c6: system; guardrail=true -> false; evidence_ids=none

## 7. Failure-Case Hits And Repeated Issues

- run_20260711T120227457_6350c6: review_required; issue=run manifest reported guardrail review required; command=none
- run_20260711T120227457_6350c6: review_required; issue=guardrail regression: no_trading_advice; command=none

### Repeated Issues
- none

## 8. Consecutive No Change Topics

- 脑机接口 BCI: count=21; current_stage=S4; run_ids=run_20260711T120227457_6350c6, run_20260711T120448376_86c2d0, run_20260711T120532061_66cf6e, run_20260711T120609281_35cfa5, run_20260711T120630686_c8886f, run_20260711T120702519_1aa0aa, run_20260711T120723766_fcf4d6, run_20260711T120738454_309065, run_20260712T161512479_220925, run_20260712T161532338_3d3640, run_20260712T172004440_7f86a6, run_20260712T172025529_6e4afc, run_20260712T172122333_54d120, run_20260712T172137443_0d28be, run_20260712T172145560_a4b892, run_20260712T173515004_e0bf3d, run_20260712T173537955_891a89, run_20260712T173544742_d4eabc, run_20260713T032611996_4c5cea, run_20260713T032639333_5d6e4f, run_20260713T032841770_1f2f1f
- 人形机器人 / 具身智能: count=21; current_stage=S5-S6; run_ids=run_20260711T120227457_6350c6, run_20260711T120448376_86c2d0, run_20260711T120532061_66cf6e, run_20260711T120609281_35cfa5, run_20260711T120630686_c8886f, run_20260711T120702519_1aa0aa, run_20260711T120723766_fcf4d6, run_20260711T120738454_309065, run_20260712T161512479_220925, run_20260712T161532338_3d3640, run_20260712T172004440_7f86a6, run_20260712T172025529_6e4afc, run_20260712T172122333_54d120, run_20260712T172137443_0d28be, run_20260712T172145560_a4b892, run_20260712T173515004_e0bf3d, run_20260712T173537955_891a89, run_20260712T173544742_d4eabc, run_20260713T032611996_4c5cea, run_20260713T032639333_5d6e4f, run_20260713T032841770_1f2f1f
- 创新药 License-out: count=21; current_stage=S5-S6; run_ids=run_20260711T120227457_6350c6, run_20260711T120448376_86c2d0, run_20260711T120532061_66cf6e, run_20260711T120609281_35cfa5, run_20260711T120630686_c8886f, run_20260711T120702519_1aa0aa, run_20260711T120723766_fcf4d6, run_20260711T120738454_309065, run_20260712T161512479_220925, run_20260712T161532338_3d3640, run_20260712T172004440_7f86a6, run_20260712T172025529_6e4afc, run_20260712T172122333_54d120, run_20260712T172137443_0d28be, run_20260712T172145560_a4b892, run_20260712T173515004_e0bf3d, run_20260712T173537955_891a89, run_20260712T173544742_d4eabc, run_20260713T032611996_4c5cea, run_20260713T032639333_5d6e4f, run_20260713T032841770_1f2f1f

## 9. High-Priority Operator Alerts

- high: guardrail_regression; action=flag_risk; message=no_trading_advice requires operator review.; run_ids=run_20260711T120227457_6350c6
- high: failed_run; action=review; message=run manifest reported guardrail review required; run_ids=run_20260711T120227457_6350c6
- high: failed_run; action=review; message=guardrail regression: no_trading_advice; run_ids=run_20260711T120227457_6350c6

## 10. Research-Only Next Actions

- flag_risk: no_trading_advice requires operator review.; run_ids=run_20260711T120227457_6350c6; evidence_ids=none
- review: run manifest reported guardrail review required; run_ids=run_20260711T120227457_6350c6; evidence_ids=none
- review: guardrail regression: no_trading_advice; run_ids=run_20260711T120227457_6350c6; evidence_ids=none

## 11. Source Artifacts

- outputs/runs/run_20260711T120227457_6350c6/run_manifest.json
- outputs/runs/run_20260711T120227457_6350c6/stage_diff.json
- outputs/runs/run_20260711T120227457_6350c6/weekly_brief.json
- outputs/runs/run_20260711T120448376_86c2d0/run_manifest.json
- outputs/runs/run_20260711T120448376_86c2d0/stage_diff.json
- outputs/runs/run_20260711T120448376_86c2d0/weekly_brief.json
- outputs/runs/run_20260711T120532061_66cf6e/run_manifest.json
- outputs/runs/run_20260711T120532061_66cf6e/stage_diff.json
- outputs/runs/run_20260711T120532061_66cf6e/weekly_brief.json
- outputs/runs/run_20260711T120609281_35cfa5/run_manifest.json
- outputs/runs/run_20260711T120609281_35cfa5/stage_diff.json
- outputs/runs/run_20260711T120609281_35cfa5/weekly_brief.json
- outputs/runs/run_20260711T120630686_c8886f/run_manifest.json
- outputs/runs/run_20260711T120630686_c8886f/stage_diff.json
- outputs/runs/run_20260711T120630686_c8886f/weekly_brief.json
- outputs/runs/run_20260711T120702519_1aa0aa/run_manifest.json
- outputs/runs/run_20260711T120702519_1aa0aa/stage_diff.json
- outputs/runs/run_20260711T120702519_1aa0aa/weekly_brief.json
- outputs/runs/run_20260711T120723766_fcf4d6/run_manifest.json
- outputs/runs/run_20260711T120723766_fcf4d6/stage_diff.json
- outputs/runs/run_20260711T120723766_fcf4d6/weekly_brief.json
- outputs/runs/run_20260711T120738454_309065/run_manifest.json
- outputs/runs/run_20260711T120738454_309065/stage_diff.json
- outputs/runs/run_20260711T120738454_309065/weekly_brief.json
- outputs/runs/run_20260712T161512479_220925/run_manifest.json
- outputs/runs/run_20260712T161512479_220925/stage_diff.json
- outputs/runs/run_20260712T161512479_220925/weekly_brief.json
- outputs/runs/run_20260712T161532338_3d3640/run_manifest.json
- outputs/runs/run_20260712T161532338_3d3640/stage_diff.json
- outputs/runs/run_20260712T161532338_3d3640/weekly_brief.json
- outputs/runs/run_20260712T172004440_7f86a6/run_manifest.json
- outputs/runs/run_20260712T172004440_7f86a6/stage_diff.json
- outputs/runs/run_20260712T172004440_7f86a6/weekly_brief.json
- outputs/runs/run_20260712T172025529_6e4afc/run_manifest.json
- outputs/runs/run_20260712T172025529_6e4afc/stage_diff.json
- outputs/runs/run_20260712T172025529_6e4afc/weekly_brief.json
- outputs/runs/run_20260712T172122333_54d120/run_manifest.json
- outputs/runs/run_20260712T172122333_54d120/stage_diff.json
- outputs/runs/run_20260712T172122333_54d120/weekly_brief.json
- outputs/runs/run_20260712T172137443_0d28be/run_manifest.json
- outputs/runs/run_20260712T172137443_0d28be/stage_diff.json
- outputs/runs/run_20260712T172137443_0d28be/weekly_brief.json
- outputs/runs/run_20260712T172145560_a4b892/run_manifest.json
- outputs/runs/run_20260712T172145560_a4b892/stage_diff.json
- outputs/runs/run_20260712T172145560_a4b892/weekly_brief.json
- outputs/runs/run_20260712T173515004_e0bf3d/run_manifest.json
- outputs/runs/run_20260712T173515004_e0bf3d/stage_diff.json
- outputs/runs/run_20260712T173515004_e0bf3d/weekly_brief.json
- outputs/runs/run_20260712T173537955_891a89/run_manifest.json
- outputs/runs/run_20260712T173537955_891a89/stage_diff.json
- outputs/runs/run_20260712T173537955_891a89/weekly_brief.json
- outputs/runs/run_20260712T173544742_d4eabc/run_manifest.json
- outputs/runs/run_20260712T173544742_d4eabc/stage_diff.json
- outputs/runs/run_20260712T173544742_d4eabc/weekly_brief.json
- outputs/runs/run_20260713T032611996_4c5cea/run_manifest.json
- outputs/runs/run_20260713T032611996_4c5cea/stage_diff.json
- outputs/runs/run_20260713T032611996_4c5cea/weekly_brief.json
- outputs/runs/run_20260713T032639333_5d6e4f/run_manifest.json
- outputs/runs/run_20260713T032639333_5d6e4f/stage_diff.json
- outputs/runs/run_20260713T032639333_5d6e4f/weekly_brief.json
- outputs/runs/run_20260713T032841770_1f2f1f/run_manifest.json
- outputs/runs/run_20260713T032841770_1f2f1f/stage_diff.json
- outputs/runs/run_20260713T032841770_1f2f1f/weekly_brief.json

