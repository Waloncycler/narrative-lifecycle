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

### 看阶段时间线

运行：

```bash
npm run timeline:rebuild
```

主题页的“阶段演化与证据链”只展示可核验的母主题变化。看到“历史证据不完整”或“历史证据缺口”并不是失败：这说明系统在诚实地告诉你，主题可能早已成熟，但当前还没有足以给中间阶段逐一标日期的来源材料。补充材料必须走候选、审核、导入流程，不能手动修改阶段或时间线。

### 补齐历史来源

运行：

```bash
npm run research:recover-history
```

先看 `outputs/research/latest_historical_evidence_recovery.md`。每项任务会说明需要补哪几个阶段门槛、需要哪类原始来源，以及检索意图。标准操作顺序是：检索权威原页、确认引用和发布日期、在 Intake 审核候选、再走现有 Evidence 导入。没有发布日期的候选不能直接导入，这是为了避免把今天的抓取时间误当作历史事件发生时间。

随后运行 `npm run research:campaign`，恢复任务会提高对应母主题的检索优先级；再按现有的 `research:retrieve` 和 Intake 流程处理来源。这个优先级不会改变阶段或评分。

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

## 5. 自动研究与正式发布

运行 `npm run agent:run` 会完成来源覆盖、线索分诊、原文摘录、候选生成、Topic/Branch 解析和运营报告刷新。默认结果只进入研究队列；不会自动写入 Evidence Table，也不会激活主题或分支。

查看 `研究待处理队列` 时，优先处理“待发布证据复核”和“引用待补全”：前者表示候选已经通过部分规则但仍需研究者决定，后者表示原始正文不足以支持事实级引用。

`npm run autonomy:run` 同样默认复核而不发布。只有在维护者明确把 `configs/autonomous_research_policy.json` 中的 `auto_publish_evidence` 设为 `true`，并显式执行下面命令时，系统才会尝试受控发布：

```bash
npm run autonomy:run -- --publish-auto
```

这不是交易或阶段决策开关。它仍要通过来源 URL、原文引用、Schema、去重、Topic/Branch、E0-E4、Data Confidence 与父主题阶段跳跃保护；Stage 和 Score 只会在 Evidence Table 写入后由确定性规则重算。MiniMax 负责候选理解和引用对应建议，不能绕过这些检查，也不能直接改变 Stage、Score、Topic Registry 或规则。

日常自动闭环使用：

```bash
npm run operate
```

它会显式请求当前版本策略允许的自动发布，并把每项通过或保留的理由写入 `outputs/autonomy/latest_promotion_report.json`。原始引用充分的受治理来源可以自动准入；低可信度、相互冲突、未定位引用或已在运行态的重复记录会自动保留，而不是伪造为已入表。

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
