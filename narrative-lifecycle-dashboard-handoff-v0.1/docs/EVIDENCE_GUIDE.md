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
