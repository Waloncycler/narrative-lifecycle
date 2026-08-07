# Evidence Guide

Evidence 是系统的入口。所有阶段、diff、weekly brief、pilot 和 replay 都必须能追溯到 evidence IDs。

## 四步

```text
录入证据
运行 weekly
查看变化
记录结果
```

本指南只讲第一步：如何录入好证据。

## 不手写 YAML：Intake Workbench

交互式本地 Workbench：

```bash
npm run intake:workbench
```

功能：

- 拖拽 TXT、Markdown、HTML、DOCX、文本型 PDF。
- 粘贴文本。
- 左侧查看原文、段落和引用高亮。
- 右侧编辑 Evidence Cards。
- 选择 Topic、Alias、Branch、Reactivation、Provisional 或 Unresolved 状态。
- 修改 E0-E4、Scope、Affected Layer、Summary、Interpretation、Limitation。
- 接受、修改、拒绝或拆分。
- 一键 Validate / Import / Weekly。
- 查看导入后 Evidence、Diff、Stage、Data Confidence 和 `why_not_higher_stage`。

静态 CLI Workbench：

运行：

```bash
npm run intake:prepare -- --file data/intake/examples/bci_branch_note.md
```

支持第一版格式：

- TXT
- Markdown
- DOCX
- HTML
- 文本型 PDF
- pasted text

Workbench 会生成候选 Evidence Cards，但不会正式导入。每张卡必须人工 review：

- accept: 接受候选。
- modify: 修改字段后接受。
- reject: 拒绝。
- split: 拆成多条 evidence。

确认后运行：

```bash
npm run intake:apply -- --decisions outputs/intake/latest_review_decisions.yaml
```

系统会继续使用现有 Schema Validator、Parent/Branch Guardrail、Duplicate Detection 和 Evidence Import。导入成功后自动运行 weekly。

## 校准候选质量

运行 Topic/Branch 解析：

```bash
npm run topic:validate
```

输出：

- `outputs/intake/latest_topic_resolution_audit.json`
- `outputs/intake/latest_unresolved_queue.json`

解析状态含义：

- `existing_topic`: 匹配现有 canonical topic。
- `alias_of`: 命中 alias，需要 audit，但不是新主题。
- `new_branch`: 可能是现有 parent 下的新分支，不能升级 parent。
- `reactivation`: 命中 Narrative Memory，应按旧主题再激活处理。
- `new_provisional_topic`: 新主题候选，默认 provisional，不能继承高阶段。
- `unresolved`: 无法判断，不能强行映射。

运行 Review Feedback 评估：

```bash
npm run intake:evaluate -- --decisions outputs/intake/latest_review_decisions.yaml
```

重点看：

- acceptance / modification / rejection / split rate
- field accuracy
- review time
- duplicate prevention
- Parent/Branch error rate
- AI shadow difference count

AI shadow 只是候选差异提示；它不能自动 import、创建 active topic、升级 stage 或修改规则。

## Real AI Shadow Validation

v0.5.7 可以接入 provider-neutral 模型适配器，对同一份文档同时生成 rule-based 与 AI-shadow 候选：

```bash
npm run intake:prepare -- --text "这里粘贴原文"
npm run intake:ai-shadow
npm run topic:validate
```

如果要跑 50 份本地 pilot 文档评估：

```bash
npm run intake:ai-evaluate
```

模型配置通过环境变量提供：

```bash
NARRATIVE_AI_SHADOW_PROVIDER=custom
NARRATIVE_AI_SHADOW_ENDPOINT=https://example.com/v1/chat/completions
NARRATIVE_AI_SHADOW_API_KEY=...
NARRATIVE_AI_SHADOW_MODEL=...
```

没有配置模型时，系统会自动 fallback 到 rule-based candidate。这不是错误，而是安全模式。输出仍会记录：

- AI 是否可用。
- 是否 fallback。
- 引用是否能在原文中找到。
- Topic/Branch/Scope/Strength/Limitation 与规则候选哪里不同。
- 是否有 unsupported claim 或 E3/E4 夸大。

输出文件：

- `outputs/intake/latest_ai_shadow_validation_report.md`
- `outputs/intake/latest_ai_shadow_audit.json`
- `outputs/intake/latest_real_ai_shadow_evaluation.md`

AI-shadow 仍然只是草稿。正式 evidence 必须由人选择 rule、AI、merge、manual 或 unresolved，并继续通过现有 validator/import/weekly。

### 中文政策文本

例如国务院关于《中医药振兴发展“十五五”规划》的批复，系统会识别为政策类候选，强度通常可到 E3，但 Topic Resolver 会保守处理：

```text
traditional_chinese_medicine_revival
```

如果 registry 里还没有正式 active topic，它会进入 `new_provisional_topic`，不能继承高阶段，也不能自动进入 active topic。研究者需要先 audit 这个主题是否真要纳入系统，再决定是否添加 canonical topic、alias 或 branch。

## Evidence 必填含义

- `evidence_id`: 稳定唯一 ID。
- `topic_id`: 属于哪个主题。
- `branch_id`: branch evidence 必填，parent evidence 留空。
- `scope`: manual import 里使用 `parent` 或 `branch`。
- `event_date`: 事件发生日期。
- `available_at`: 研究者可获得这条证据的日期。
- `event_title`: 一句话说明事件。
- `event_summary`: 事实摘要。
- `source_name`: 来源名称。
- `source_url`: 来源链接或内部占位链接。
- `source_type`: official、filing、news、research、academic、company、other。
- `evidence_strength`: E1-E4。
- `affected_layer`: 影响哪些层。
- `interpretation`: 这条证据支持什么。
- `limitation`: 这条证据不能证明什么。
- `confidence`: low、medium、high。

## available_at

`available_at` 用来防止 Replay 偷看未来。

例子：

```text
event_date: 2026-05-20
available_at: 2026-05-25
```

意思是事件发生在 5 月 20 日，但研究者 5 月 25 日才可用它。在 5 月 21 日的 replay slice 中，这条 evidence 不能被使用。

## Parent vs Branch

Parent evidence 回答：

```text
整个主题是否被验证？
```

Branch evidence 回答：

```text
某个分支是否被验证？
```

BCI 的医疗康复分支可以进入 S5-S6 或 S7C，但这不能自动让 BCI parent 进入 S6 或 S7C。

## Evidence Strength

- E1: 弱信号或单点观察。
- E2: 可用但仍有限的证据。
- E3: 明确、可追踪、质量较高的证据。
- E4: 硬现实证据，例如多客户复现、收入确认、标准采纳、供需约束等。

E4 也不能跳过 scope。branch E4 仍然只是 branch E4。

## Limitation 写法

好的 limitation：

```text
Supports medical rehabilitation branch only; does not prove parent-level pricing or reality validation.
```

不好的 limitation：

```text
Very bullish.
```

系统需要知道证据边界，而不是情绪。

## 导入命令

```bash
npm run evidence:validate
npm run evidence:import -- --file data/imports/evidence_draft.example.yaml
```

导入后再运行：

```bash
npm run weekly
```
