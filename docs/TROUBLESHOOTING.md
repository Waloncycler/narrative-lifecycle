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

## intake:prepare 没有候选

检查：

- 文件是否是 TXT、Markdown、DOCX、HTML 或文本型 PDF。
- PDF 是否是扫描版。第一版不做 OCR。
- 原文是否只有标题，没有事实句。

可以改用 pasted text：

```bash
npm run intake:prepare -- --text "这里粘贴原文"
```

## intake:apply 没有导入

先看：

```text
outputs/intake/latest_apply_result.md
outputs/imports/evidence_import_report.md
```

常见原因：

- review YAML 仍是 `decision: reject`。
- `scope: branch` 但缺 `branch_id`。
- evidence_id 与已有证据重复。
- 人工修改后触发 Parent/Branch guardrail。
- 文本里出现交易动作词。

Workbench 只生成候选。正式进入系统前必须通过现有 import 流程。

## intake:workbench 打不开

先确认命令仍在运行：

```bash
npm run intake:workbench
```

默认地址：

```text
http://localhost:4177
```

如果端口占用：

```bash
npm run intake:workbench -- --port 4188
```

交互式 Workbench 只是本地工具。它不会自动联网、不会 OCR、不会绕过 Evidence Import，也不会把 AI shadow 建议自动导入。

## topic:validate 出现 unresolved

先看：

```text
outputs/intake/latest_unresolved_queue.json
outputs/intake/latest_topic_resolution_audit.md
```

常见原因：

- 候选原文没有足够主题线索。
- 命中了新词，但不在 Alias Registry。
- 可能是全新主题，应先作为 provisional topic。

处理：

- 不要强行映射到现有高阶段主题。
- 给 `data/topic_registry/aliases.yaml` 或 `branches.yaml` 增加人工审核后的 alias/branch。
- 如果仍不确定，保持 unresolved，等待更多证据。

## 中文政策粘贴后没有进入旧主题

这是预期的保守行为。

例如《中医药振兴发展“十五五”规划》这类国务院政策文本，会被识别为政策类 Evidence Candidate，并映射到：

```text
traditional_chinese_medicine_revival
```

如果这个主题尚未在 Canonical Topic Registry 中激活，`topic:validate` 会把它放进 `new_provisional_topic`，而不是强行映射到已有主题。

处理：

- 看 `outputs/intake/latest_topic_resolution_audit.md`。
- 如果确实要跟踪中医药振兴主题，人工审核后再维护 canonical topic / alias。
- 不要让 provisional topic 自动继承高阶段。
- 不要把 branch evidence 当作 parent evidence。

## intake:ai-shadow 全部 fallback

先看：

```text
outputs/intake/latest_ai_shadow_audit.json
outputs/intake/latest_ai_shadow_validation_report.md
```

常见原因：

- 没有配置 `NARRATIVE_AI_SHADOW_ENDPOINT` 或 `NARRATIVE_AI_SHADOW_API_KEY`。
- provider timeout。
- 模型返回不是 Evidence Candidate JSON。
- 模型引用的 quote 在原文中找不到。
- 模型输出出现交易动作词。
- 模型把 branch evidence 写成 parent evidence。
- 模型把 E1/E2 证据夸大成 E3/E4。

处理：

- 无 provider 时 fallback 是安全模式，可以继续用 rule-based candidate。
- 配置 provider 后重新运行 `npm run intake:ai-shadow`。
- 不要把 AI-shadow 输出直接 import。
- 人工选择 rule、AI、merge、manual 或 unresolved 后，再走 Validate / Import / Weekly。

## intake:ai-evaluate 指标是 pending_human_review

这是早期评估的正常状态。

没有盲审决策之前，precision、recall、Topic/Branch accuracy、field modification 等指标不能编造。系统会先输出：

```text
pending_human_review
```

真实评估需要研究者完成候选选择、修改、拒绝、拆分和 outcome 记录。

## intake:evaluate 指标偏低

先看：

```text
outputs/intake/latest_evaluation.md
```

常见解释：

- modification rate 高：候选字段映射还需要校准。
- rejection rate 高：文档 chunk 太宽、来源噪音较多，或证据强度不足。
- Parent/Branch error rate 高：branch 语言被误写成 parent，或 branch_id 不稳定。
- AI shadow difference count 高：规则和 shadow adapter 对 Topic/Branch 判断不一致，需要人工复核 registry。

处理：

- 优先补 Alias Registry 和 Branch Registry。
- 不要因为 AI shadow 建议而自动创建 active topic。
- new provisional topic 保持 S0，直到有正式 audit 和 Evidence Table 支撑。

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

Evidence Intake：

```text
outputs/intake/latest_workbench.html
outputs/intake/latest_apply_result.md
```
