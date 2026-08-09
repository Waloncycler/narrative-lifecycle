# 历史基线证据准入

历史 Evidence Table 是研究存储，不会因为存在于 JSON 文件中就自动进入运营阶段。
`baseline:review` 只生成核对报告；它不修改 Evidence、Topic、Branch、Stage 或 Score。

```bash
npm run baseline:review
```

输出：

```text
outputs/research/latest_baseline_evidence_reconciliation.json
outputs/research/latest_baseline_evidence_reconciliation.md
```

系统仅将满足以下条件的**父主题**记录列为待审核候选：E2 及以上、置信度至少 60、可解析原文 URL、有效日期、受限的来源类型，以及至少两个独立来源。分支记录永远不会被列入整体主题的基线包。

审核人确认某一主题后，使用具名准入命令：

```bash
npm run baseline:admit -- --topic humanoid_robotics --reviewer "research-operator"
```

该命令会把本次报告中的父主题候选写入不可追加覆盖的 `migration_baseline` 审计记录，并立即重建运营快照。它不导入新闻线索、不推测阶段，也不把分支证据提升为父主题证据。

## 原始来源复核

历史表中“有长摘要”不等于“可进入运行态”。复核任务会先从 `baseline:review` 的父主题候选中选择条目，重新取得可定位的原始页摘录，并要求两个独立来源交叉印证。默认只写入既有 Intake/Agent 审核链及失败原因，不直接准入。

```bash
npm run baseline:verify
npm run baseline:verify -- --topic humanoid_robotics --max-evidence 4
```

只有在策略允许且显式传入 `--publish-auto` 时，已通过原始页、双来源、Topic/Branch、模型和 Evidence Gate 的**新候选**才会请求自动发布。旧记录的 E3/E4 标签不会因为来源重获而自动继承或抬高；分支记录绝不用于母主题基线。
