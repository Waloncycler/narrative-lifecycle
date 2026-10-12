# Narrative Lifecycle Dashboard 交接文档

- 更新日期：2026-08-14
- 代码分支：`main`
- 包版本：`0.13.5`
- 当前重点：高覆盖新闻采集、正文解析、Evidence 自动准入与连续阶段演化

## 1. 项目使命与硬约束

本系统用于研究主题及其分支从 S0 到 S7 的生命周期，不是交易系统，不生成买卖、仓位、目标价或交易建议。

必须始终满足：

- Stage First, Score Second。
- 没有 Evidence Table，不得评分。
- Evidence 必须保留原文引用、来源、日期和可审计路径。
- Parent Narrative 与 Branch Narrative 分开判断，分支证据不能升级母题。
- 旧主题先查询 Narrative Memory，再判断 reactivation 或新主题。
- Data Confidence 可以限制阶段上限。
- 新闻热度只影响研究优先级，不能提高 Evidence strength 或 Stage。
- 新主题默认 provisional，不得自动继承高阶段。

## 2. 当前产品形态

保留既有本地研究界面和路由，不需要另建简化版 React/Vite 前端。前端应继续展示总览、主题、变化、研究队列、Agent、来源、系统状态、学习治理和方法论。

核心数据已迁移到 SQLite：`data/narrative.db`。主要表包括：

- `topics`、`branches`、`evidence`
- `raw_documents`、`intake_sessions`
- `system_runs`、`stage_snapshots`、`stage_diffs`、`weekly_briefs`
- `generic_artifacts`：兼容尚未拆成独立表的公共 artifact 和旧读取路径

`outputs/`、`operator_runs/` 等路径仍可能作为兼容逻辑 id 或操作员视图存在，不得假定已经永久删除。数据库是运行态事实来源，稳定 artifact id 用于兼容 CLI 和前端。

## 3. 已打通的主链路

```text
外部来源同步
→ 新闻事件分类与聚类
→ Evidence 潜力排序和 Topic/Branch 初步映射
→ 事件类型定向检索
→ 原始网页正文获取与引用提取
→ Agent 批量结构化候选
→ Topic Resolver / Duplicate / Parent-Branch Guardrail
→ 自动准入策略
→ Evidence Table
→ Stage Gate
→ Score
→ Diff / Weekly / Operator Review / 前端
```

关键实现：

- 新闻漏斗：`src/features/research/domain/news_evidence_funnel.ts`
- 新闻探针：`src/app/use_cases/probe_prioritized_news_use_case.ts`
- Agent adapter：`src/features/intake/io/intake_agent_provider.ts`
- 来源同步：`src/app/use_cases/sync_worldmonitor_sources_use_case.ts`
- 历史 Diff 加载：`src/features/stages/pipeline/diff_artifact_loader.ts`
- 数据库装配：`src/platform/io/app_di_container.ts`

## 4. 本轮完成内容

- 默认日常来源扩大到 24 个，覆盖监管、交易所、公司披露、财经新闻、科技、研究和宏观来源。
- 新闻处理不再只按阅读量排序；独立计算事件类型、证据潜力、主题相关性和验证目标。
- 事件簇去重并按主题/事件类别分配预算，避免一个热点挤占全部处理能力。
- quick/daily/deep/manual 探针上限分别为 24/100/160/60。
- 未治理域名可进入有限 discovery lane，但始终是 `context_only`，不能作为交叉验证或正式 Evidence。
- Agent 按 25 条分批，默认串行；429/5xx 最多重试三次并退避，单批失败只回退该批。
- 监管机构检索同时读取标题与摘要。
- 满足日期、完整引用、治理来源、直接公共原始记录和 direct-fact 条件的记录可标记为 `rule_verified E1`，随后仍须经过既有准入政策。
- 修复 `stage_snapshots` 数据库读取，weekly 已能找到上一快照，不再持续生成伪 initial snapshot。
- 恢复 `reports/weekly_brief.json` 与 run-level snapshot/weekly artifact 的兼容 id。

## 5. 最近一次真实运行

命令：

```bash
npm run research:agent -- --kind quick --publish-auto --force-refresh
```

运行：`agent_run_20260813182746911`

结果：

| 指标 | 数值 |
| --- | ---: |
| 来源完成 | 21 / 24 |
| 原始信号 | 1,261 |
| 新闻事件簇 | 1,146 |
| 漏斗选择 | 240 |
| Intake candidates | 253 |
| 深挖新闻 | 16 |
| 搜索线索 | 262 |
| 正文获取尝试 | 34 |
| citation-ready seed | 11 |
| 完成验证 | 0 |
| 新增 Evidence | 0 |

这次运行发生在最后一组修复之前。零准入的直接原因是：探针没有形成完整交叉验证包，MiniMax 11 个批次全部返回 HTTP 429。随后已增加退避重试、提高探针上限、扩展机构识别，并允许严格满足条件的官方原始记录以 E1 进入正常准入链。下一次 live daily/deep run 必须验证这些改动是否真正提高准入率。

## 6. 当前真实瓶颈

1. 1,146 个事件簇中只有少量进入深挖，检索广度已经提升，但正文和验证吞吐仍不足。
2. 大量搜索结果是摘要、转载、导航页或不受治理域名，不能安全准入。
3. Topic Resolver 对 240 条选择中的大量记录仍返回 unresolved；不能通过强行映射解决。
4. MiniMax 有明显速率限制。重试已实现，但尚未完成修复后的真实运行验证。
5. learning cycle 因缺少 Intake learning profile 仍被跳过，自迭代反馈闭环未完全落地。
6. CLI 在长时间外部调用中缺少 phase progress 输出，容易被误认为卡死。

## 7. 下一执行顺序

1. 运行一次修复后的 daily：

```bash
npm run research:agent -- --kind daily --publish-auto --force-refresh
```

2. 对比以下 artifact：

- `research/latest_news_evidence_funnel.json`
- `research/latest_news_probe_diagnostics.json`
- `outputs/intake/latest_agent_audit.json`
- `autonomy/latest_promotion_report.json`
- `research_agent/latest_run.json`

3. 验收目标：至少一个非重复、可追溯、Topic/Branch 合法的 E1 Evidence 通过正式自动准入；若仍为 0，按 promotion report 的 hold reasons 做数量聚合，禁止继续盲目增加来源。
4. 建立 Intake learning profile，使接受、修改、拒绝、拆分和 resolver 错误进入下一轮提示词与规则建议。
5. 为长运行增加 phase progress 和漏斗实时状态，但不要引入新的前端框架。
6. daily 稳定后再运行 deep；不得用降低来源治理、引用或 Parent/Branch 门槛换取表面准入率。

## 8. 验证状态

```text
npm run typecheck  PASS
npm test           PASS: 94 files / 420 tests
Golden cases       PASS: 3 / 3
weekly             PASS
git diff --check   PASS
```

最新 Diff 已能读取有效上一快照，状态为 `ok`，没有 guardrail regression。

## 9. 工作区注意事项

- 当前工作区包含大量未提交改动和运行态数据库/WAL 变化，不得使用 `git reset --hard` 或回滚不属于当前任务的修改。
- `README.md` 是冻结的产品与方法论基准，未经用户明确许可不得修改。
- `data/narrative.db` 包含本地运行结果；提交前需明确区分代码、文档、测试和运行态数据。
- 不要恢复已删除的简化 Vite 页面；原有研究界面是唯一目标前端。
