# 阶段基准补全与命名治理

## 目标

将“系统没有父主题证据”与“市场仍处早期”严格分开，并让缺口进入可执行研究闭环。

```text
当前运营快照 + Topic / Branch Registry
-> 基准补全计划
-> 高优先级覆盖任务
-> 外部线索与权威 API
-> 线索分诊
-> 有限原文摘录
-> Intake / 引用核验 / Topic Resolver / 去重
-> Evidence Table
-> Stage Gate
```

## 自动执行

```bash
npm run research:baseline
npm run research:campaign -- --max-tasks 24 --max-queries 12
```

`research:campaign` 会自动重新生成基准计划，因此单独运行第一条命令只用于检查计划。

计划有三类事项：

- `parent_evidence_baseline`：活跃父主题处于 `S0` 且没有父主题正式 Evidence。它获得高优先级检索，并关注名称、资源、市场预期与现实验证层。
- `topic_name_verification`：主题中文市场名称尚未有来源支持。
- `branch_name_verification`：分支中文市场名称尚未有来源支持，或其原始记录是编号、复制文本、模型残留。

## 不可逾越的边界

- 基准计划不是 Evidence，也不等同于成熟度判断。
- 计划只改变研究优先级，不能直接修改 Stage、Score、Data Confidence、Topic/Branch 状态或 Registry 名称。
- 网页和 API 原文只保存有限摘录，仍为 `context_only`。
- 父主题需要父范围 Evidence；分支材料不能补父主题证据表。
- 名称必须有可追溯来源引用后才可标为 `verified`；系统不会从内部 ID 或模型文本生成市场共识名称。
- 不产生交易、买卖、仓位或价格建议。

## 研究者动作

在 Agent 页先看“阶段基准与命名补全”，再打开“可复核的原文摘录”。只有确认原文引用、范围、限制与去重结果后，才通过 Intake 提交到现有 Evidence Gate。
