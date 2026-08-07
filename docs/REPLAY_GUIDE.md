# Replay Guide

Historical Narrative Replay 用历史时间切片测试规则是否可靠。

核心原则：

```text
只能使用当时 available_at 已经可获得的 evidence。
运行后才揭晓 outcome。
不得用价格上涨反推判断正确。
```

## 四步

```text
录入证据
运行 weekly
查看变化
记录结果
```

Replay 对应的是第四步之后的校准：回头检查当时的规则是否会做出同样判断。

## 运行 Replay

```bash
npm run replay
```

输入：

```text
data/replay/replay_cases.yaml
```

输出：

```text
outputs/replay/latest_replay_ledger.json
outputs/replay/latest_replay_ledger.md
outputs/replay/history/replay_ledger_<run_id>.json
```

## Replay Case 是什么

一个 case 包含：

- topic 信息。
- T0-Tn 时间切片。
- 每条 evidence 的 `event_date` 和 `available_at`。
- outcome 揭晓日期。
- 正确阶段。
- 校准建议。

每个 slice 只会使用：

```text
available_at <= as_of
```

未来 evidence 会写入：

```text
future_evidence_excluded
```

## 如何读 Replay Ledger

优先看：

1. `stage_path`: 每个时间切片的阶段路径。
2. `future_evidence_excluded`: 当时不能使用的证据。
3. `misclassification`: 是否误判。
4. `lead_time_days`: 提前量。
5. `missed_change`: 是否漏报。
6. `false_positive`: 是否过早确认。
7. `calibration_suggestion`: 应该如何调整规则。

## 覆盖案例

当前 fixture 覆盖：

- success: 规则提前识别并被后续 outcome 确认。
- failure: 规则过早给高阶段，后续 outcome 证伪。
- s7b: 进入衰退或过热后的状态判断。
- s7c: branch mutation，不能污染 parent。
- long_no_change: 长期无变化是合法状态。

## BCI S7C 示例

如果医疗康复 branch 出现 S7C：

```text
branch_stage = S7C
parent_stage = S4
```

这不是矛盾。它表示分支发生 mutation，但 parent narrative 缺少 parent-level pricing 和 reality evidence。

## Replay 不做什么

- 不重新定义 Stage Gate。
- 不使用 outcome 反推当时判断。
- 不把价格上涨当作判断正确。
- 不把 branch 变化升级为 parent 变化。
- 不生成交易动作。
