# 自动证据治理

`npm run operate` 是自动研究闭环的单一入口：来源同步、原始页取证、MiniMax 候选核验、主题与分支解析、策略准入、阶段重算和运行审计依次执行。

自动模式不是让模型直接决定事实或阶段。MiniMax 只输出候选的事实拆分、引用对应关系和 Topic/Branch 建议；以下检查全部由确定性代码完成：

1. 原始 URL 与可定位引用必须存在。
2. Evidence Schema、E0-E4、置信度、日期和无交易建议必须通过。
3. Topic Resolver、Narrative Memory、父主题/分支边界和去重必须通过。
4. 只有策略允许的来源类别可发布；新闻线索不能自动发布。
5. Evidence 写入后才重算 Stage；Stage Gate 先于 Score。

```bash
npm run operate
```

当前策略只会自动发布带日期、可定位原始引用、`rule_verified` 的受治理来源记录。相同 Evidence ID 若仅存在于历史研究存储、尚未进入运行态，新的原始来源取证可以受控地替换该旧记录并追加 `automated_publication` 审计记录。已在运行态的相同记录、不同 ID 的重复记录、低可信度材料和 CAPTCHA/空正文仍会自动保留。

这使自动化可以持续处理可验证的新材料，同时把历史落地页、无摘要记录和缺少原始引用的材料送入历史来源恢复队列。它们不会因为“自动化”而被伪造成正式 Evidence。

## 历史来源重获

`npm run operate` 每次会额外处理一个小批次的历史来源恢复任务；也可以单独运行：

```bash
npm run history:reacquire -- --max-targets 3 --publish-auto
```

对一条已知的历史记录做定向核验时，可使用 `--evidence-id <id>`；它只缩小本次检索批次，不会绕过任何来源、双源、Agent 或准入门槛。

流程是：旧 Evidence 行的标题和原链接仅作为检索线索 → 通过配置的网页搜索适配器发现候选原页 → 抓取有界正文与可定位引文 → 要求两个不同来源主机对同一标题形成交叉验证 → 只将一个主来源包附加到当前 Intake Session → MiniMax、Topic Resolver、重复检查、Evidence Schema 和自动准入策略再次执行。

双来源只证明“可以进入自动准入链”，不会把材料抬升为 E2/E3/E4，也不会直接改变 Stage。单源、落地页、正文过短、标题不一致、无法确认 Topic/Branch 范围的记录都会保持 `hold`。分支的两条来源只能形成分支候选，不能与母主题来源混合凑成验证。

普通日常发现还受 `maximum_source_age_days` 限制，默认只接受 180 天内的可引用原页，避免旧论文被误报为本期变化。超过期限的材料只能通过双来源历史重获进入基线恢复链。

每次研究运行都会把**所有已配置的搜索引擎并行跑一遍**，而不是只选一个：无密钥的 `free` 公开索引聚合始终参与（含 DuckDuckGo HTML、Bing RSS、GDELT、Wikipedia、Reddit、arXiv 等），只要配置了凭据或端点，MiniMax、SearXNG、Tavily、Brave、MCP 检索网关就一并加入；各引擎结果按 URL 去重合并，报告通过 `providers` 字段记录实际参与的全部引擎。`NARRATIVE_WEB_SEARCH_PROVIDERS`（逗号分隔）或 `NARRATIVE_WEB_SEARCH_PROVIDER`（单数）用于追加特定引擎（例如独立跑一次 DuckDuckGo），不再用于把搜索收窄为单引擎；只有显式 `disabled` 才会关闭 `free` 聚合。引擎级配置：`minimax` 密钥按 `MINIMAX_CODE_PLAN_KEY` → `MINIMAX_CODING_API_KEY` → `MINIMAX_OAUTH_TOKEN` → `MINIMAX_API_KEY` 顺序解析，`MINIMAX_SEARCH_REGION` 选择 global/cn 端点；`searxng` 设置 `SEARXNG_BASE_URL` 后自动检测，`http://` 基础 URL 仅允许回环/私有主机，公共实例必须使用 `https://`；`duckduckgo` 为无密钥、实验性，需显式加入；若部署了检索 MCP 网关，配置 `mcp_bridge`、`NARRATIVE_WEB_SEARCH_ENDPOINT` 与密钥。无论何种适配器，搜索摘要都不是 Evidence。

## 多轮迭代深搜

`npm run research:agent -- --kind deep` 在固定的每日/快速循环之外提供有界的、多轮的自主深挖：第 0 轮以更大规模执行源感知覆盖计划；之后每一轮从上一轮线索的标题确定性推导新的追问检索词（带 Topic/分支/覆盖任务/来源作用域元数据），重新进入同一套线索分诊 → 原文提取 → Intake Agent → AI Shadow 通道，并把同一个 Intake Session 跨轮延续，避免重复导入。

```bash
npm run research:agent -- --kind deep --max-rounds 3 --queries-per-round 12
```

调度器默认每日 07:00（`deep_cron`）自动触发，`deep_max_rounds` 上限 20、`deep_queries_per_round` 上限 50。所有轮次的搜索结果始终只是 `context_only` 待核验线索，必须通过既有 Agent 与准入策略才能进入运行态 Evidence；轮次与检索词都受预算约束，工件写入 `outputs/research_agent/latest_deep_research_sweep.json`。

## 审计与边界

- 自动准入写入 `data/audit/operational_evidence_admission.jsonl`，不覆盖既有审计记录。
- 运行结果位于 `outputs/autonomy/latest_promotion_report.json`；每条保留项都会说明原因。
- 分支证据只更新分支证据链，永远不升级母主题。
- 不输出买卖、仓位、目标价或交易建议。
