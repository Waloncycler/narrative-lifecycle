# Troubleshooting

按四步排查：

```text
录入证据
运行 weekly
查看变化
记录结果
```

## evidence:validate 失败

先看：

```text
outputs/imports/evidence_validation_report.md
```

常见原因：

- 缺少 `available_at`。
- `scope: branch` 但没有 `branch_id`。
- E3/E4 缺少可靠来源。
- E4 没有说明硬现实依据。
- parent evidence 混入 branch-only 描述。
- 文本里出现交易动作词。

修正 evidence draft 后重新运行：

```bash
npm run evidence:validate
```

## weekly 没有升级阶段

先不要认为系统漏看了证据。检查：

- evidence 是否导入成功。
- evidence IDs 是否出现在 weekly brief。
- `why_not_higher_stage` 写了什么。
- evidence 是 parent 还是 branch。
- Data Confidence 是否限制了最高阶段。

常见情况：

```text
branch evidence 很强，但 parent evidence 不足。
```

这时 parent 不升级是正确行为。

## diff 显示 no_change

`no_change` 是合法状态。

它表示当前 persisted artifacts 与上一轮没有机械差异。研究者可以继续观察，不需要强行生成动作。

## review 显示 guardrail regression

先看：

```text
outputs/reviews/latest_operator_review.md
```

重点检查：

- 是否缺 evidence IDs。
- 是否缺 `why_not_higher_stage`。
- 是否 parent/branch 混淆。
- 是否出现非研究动作。

## pilot:review 是 insufficient_history

这是正常早期状态。

Pilot 需要人工持续记录：

```text
data/pilot/operator_observations.yaml
```

只有有足够 outcome 后，agreement、precision、follow-through 才能计算。

## replay 失败

先看报错是否来自：

- `available_at` 缺失。
- `available_at` 早于 `event_date`。
- replay case 缺 slices。
- outcome 缺 correct stage。
- fixture 文本里出现交易动作词。

Replay 的关键不是让结果好看，而是确认系统没有偷看未来。

## 我应该先看哪个文件

日常研究：

```text
outputs/reports/weekly_brief.md
```

变化原因：

```text
outputs/diffs/latest_stage_diff.md
```

历史趋势：

```text
outputs/reviews/latest_operator_review.md
```

Live pilot：

```text
outputs/pilot/latest_research_ledger.md
```

历史回放：

```text
outputs/replay/latest_replay_ledger.md
```
