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
