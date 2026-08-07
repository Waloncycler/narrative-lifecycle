# Operator Guide

## 你的工作流

```text
录入证据 -> 运行 weekly -> 查看变化 -> 记录结果
```

你不需要先理解代码。把系统当作一个研究日志和阶段校验器。

## 1. 录入证据

证据必须先进入 Evidence Table。没有 evidence table，就没有阶段判断，也没有评分。

录入时先问：

- 这条证据是 parent 证据，还是 branch 证据？
- 它支持 name、capital、pricing、reality、momentum、friction 中哪一层？
- 它什么时候发生？
- 我什么时候能看到它？
- 它不能证明什么？

`available_at` 很重要。Replay 会用它防止偷看未来。

## 2. 运行 weekly

运行：

```bash
npm run weekly
```

weekly 会完成：

- pipeline
- diff
- weekly brief
- immutable run history

它不会自动抓取新证据，也不会替你生成交易动作。

## 3. 查看变化

优先看 `outputs/reports/weekly_brief.md`。

阅读时只抓四件事：

1. 当前状态：topic 当前阶段是什么？
2. 变化原因：新增、删除或改变了哪些 evidence IDs？
3. 为什么不能更高：`why_not_higher_stage` 是什么？
4. 下一步验证：需要等哪类 evidence？

然后看 `outputs/diffs/latest_stage_diff.md`：

- `stage_upgrade`: 阶段上升。
- `stage_downgrade`: 阶段下降。
- `evidence_added`: 有新增证据但阶段没变。
- `branch_mutation_candidate`: branch 发生变化，不能自动理解为 parent 升级。
- `no_change`: 没有变化，这是合法状态。

## 4. 记录结果

运行：

```bash
npm run review
```

它会把历史 runs 聚合成 operator review。

如果你在做 live pilot，继续记录：

```text
data/pilot/operator_observations.yaml
```

常用字段：

- `operator_agreement`: agree、disagree、uncertain。
- `operator_comment`: 你为什么同意或不同意。
- `outcome_status`: pending、confirmed、weakened、falsified。
- `missed_change`: 系统是否漏掉了重要变化。

运行：

```bash
npm run pilot:review
```

## 如何判断一张 Dashboard Card

不要先看结论。按这个顺序：

1. `current_stage`
2. `evidence_ids`
3. `why_not_higher_stage`
4. `data_confidence`
5. `key_branches`
6. `next_triggers`
7. `failure_signals`

如果 branch 是 S6，但 parent 是 S4，这通常是正常结果。系统是在说：branch 已验证，但 parent 还缺证据。

## 附录：系统边界

- 不生成买卖建议。
- 不生成仓位、目标价、执行指令。
- 不用 LLM 跳过 Evidence Table。
- Stage First, Score Second。
- Parent narrative 和 branch narrative 分开判断。
- Old theme 先查 Narrative Memory，再判断是否是新主题。
