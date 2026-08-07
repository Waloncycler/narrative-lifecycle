# Quickstart

面向研究者的最短流程：

```text
录入证据
运行 weekly
查看变化
记录结果
```

这个系统不是交易系统。它只回答四个问题：

1. 当前叙事处在什么阶段？
2. 为什么发生变化？
3. 为什么不能给更高阶段？
4. 下一步验证什么？

## 1. 录入证据

如果你不想手写 YAML，优先启动交互式 Intake Workbench：

```bash
npm run intake:workbench
```

打开终端显示的本地地址，通常是：

```text
http://localhost:4177
```

你可以拖拽 TXT、Markdown、HTML、DOCX、文本型 PDF，或直接粘贴文本。右侧 Evidence Cards 支持修改 Topic、Branch、Scope、E0-E4、Affected Layer、Summary、Interpretation 和 Limitation，然后点击 `Validate / Import / Weekly`。所有正式导入仍会经过现有 Validator、Duplicate Detection、Parent/Branch Guardrail 和 Evidence Import。

CLI 兼容路径仍然可用：

```bash
npm run intake:prepare -- --file data/intake/examples/bci_branch_note.md
```

打开：

```text
outputs/intake/latest_workbench.html
```

左侧是原文和高亮引用，右侧是候选 Evidence Cards。把 review template 改成 accept、modify、reject 或 split：

```text
outputs/intake/latest_review_decisions.yaml
```

确认后运行：

```bash
npm run intake:apply -- --decisions outputs/intake/latest_review_decisions.yaml
```

它会先走现有 Evidence Import，成功后自动运行 weekly。

检查 Topic/Branch 是否被安全解析：

```bash
npm run topic:validate
```

如果候选是 `unresolved` 或 `new_provisional_topic`，不要强行映射成高阶段主题；先补人工判断，或把它留在 provisional queue。

评估这次候选质量：

```bash
npm run intake:evaluate -- --decisions outputs/intake/latest_review_decisions.yaml
```

重点看 acceptance rate、modification rate、field accuracy、review time、duplicate prevention 和 Parent/Branch error rate。

### 手写 YAML

复制 `data/imports/evidence_draft.example.yaml`，新增一条 evidence。

最重要字段：

- `topic_id`: 主题 ID。
- `scope`: `parent` 或 `branch`。
- `event_date`: 事件发生日。
- `available_at`: 研究者当时能看到这条证据的日期。
- `evidence_strength`: `E1` 到 `E4`。
- `affected_layer`: name、capital、pricing、reality、momentum、friction、data_confidence。
- `interpretation`: 这条证据支持什么。
- `limitation`: 这条证据不能证明什么。

先验证：

```bash
npm run evidence:validate
```

再导入：

```bash
npm run evidence:import -- --file data/imports/evidence_draft.example.yaml
```

## 2. 运行 weekly

```bash
npm run weekly
```

这会生成一个新的 run，并更新：

- `outputs/runs/latest_run.json`
- `outputs/diffs/latest_stage_diff.json`
- `outputs/reports/weekly_brief.md`

## 3. 查看变化

先看：

```text
outputs/reports/weekly_brief.md
outputs/diffs/latest_stage_diff.md
```

阅读顺序：

1. 当前阶段。
2. 新增或删除的 evidence IDs。
3. `why_not_higher_stage`。
4. Data Confidence 是否变化。
5. branch 是否只是 branch 变化。

## 4. 记录结果

运行历史 review：

```bash
npm run review
```

如果正在做 live pilot，编辑：

```text
data/pilot/operator_observations.yaml
```

然后运行：

```bash
npm run pilot:review
```

## 完整示例

1. 在 `data/imports/evidence_draft.example.yaml` 新增一条 BCI 医疗康复 branch evidence。
2. 设置 `scope: branch`，并填写 `branch_id: bci_medical_rehab`。
3. 设置 `available_at` 为你实际看到证据的日期。
4. 运行 `npm run evidence:validate`。
5. 运行 `npm run evidence:import -- --file data/imports/evidence_draft.example.yaml`。
6. 运行 `npm run weekly`。
7. 打开 `outputs/reports/weekly_brief.md`，确认 parent BCI 是否仍为 S4。
8. 打开 `outputs/diffs/latest_stage_diff.md`，确认 branch change 没有升级 parent。
9. 编辑 `data/pilot/operator_observations.yaml`，记录 `operator_agreement` 和 `outcome_status`。
10. 运行 `npm run pilot:review`。

正确读法：

- 如果 BCI parent 仍是 S4，这不是系统没看到 branch 证据。
- 它表示 parent evidence 和 branch evidence 被分开判断。
- 下一步验证重点是 parent-level pricing 和 parent-level reality evidence。

## 附录：常用命令

```bash
npm run evidence:validate
npm run evidence:import -- --file data/imports/evidence_draft.example.yaml
npm run weekly
npm run review
npm run pilot:review
npm run replay
npm run intake:workbench
npm run intake:prepare -- --file data/intake/examples/bci_branch_note.md
npm run intake:apply -- --decisions outputs/intake/latest_review_decisions.yaml
npm run topic:validate
npm run intake:evaluate -- --decisions outputs/intake/latest_review_decisions.yaml
```
