# 权威来源网与研究主题宇宙

## 目的

本模块将“多找一些新闻”替换为可审计的研究覆盖循环：

```text
权威来源能力目录 + 市场通用名称的研究种子
-> 主题 / 分支覆盖计划
-> 受来源域约束的外部检索或已接通 API
-> 原始页面核验与候选 Evidence
-> Topic Resolver / Narrative Memory / 去重
-> Evidence Table
-> Stage Gate
-> Score / Diff / Weekly / Review
```

目标是让系统持续发现值得研究的方向、分支和证据缺口，同时避免把“搜索结果很多”误认为“主题已经成立”。

## 三份配置

`data/source_atlas/authoritative_sources.yaml` 是来源能力目录。每个来源都明确记录权威层级、覆盖领域、可补充的证据层、接入方式、自动轮询许可、复核要求、证据强度上限和使用条款链接。

来源目录不是连通性声明。只有已有连接器且运行时配置完成的来源才能被实际读取。

`data/research_universe/core_topics.yaml` 是研究种子库，覆盖人工智能、先进制造、生物医药、能源、宏观与跨行业方向。每个种子包含常用中文名称、英文检索名、别名、候选分支、需要补的证据层和优先来源。研究种子不是正式 Topic，不会继承阶段，也不会自动出现在正式主题看板。

`data/company_registry/core_companies.yaml` 是跨市场公司核验目录。它收录中国、香港、美国及全球重点科技、先进制造、能源和生物医药公司的常用中英文名称、官网/IR 页面、披露渠道和关联 Topic/Seed。目录只决定“值得去哪个官方页面核验”，不代表公司材料已被读取，更不是主题热度、投资名单、证据或阶段判断。

为使看板能覆盖研究者已知的主流方向，登记册也可以由研究负责人进行一次性策展：当前有 17 个正式监控主题，其中 14 个是人工策展的 `S0` 基线。策展只授予“进入覆盖计划”的资格，绝不补写 Evidence、Stage、Score 或分支状态；本次清单与理由在 `data/audit/core_topic_curation_20260803.json`。名称仍保留各自的 `naming_status`，未有命名来源的名称不能据此自动激活新图谱节点。

## 运行

```bash
npm run research:campaign
npm run research:triage
npm run agent:run -- --kind daily
```

第一条命令生成 `outputs/research/latest_campaign.{json,md}`，并在网页与直连来源任务完成后生成 `outputs/research/latest_lead_triage.{json,md}`。每个任务都包含具体主题或分支、来源目标、允许来源域、检索语句、目标证据层及其“正式/暂定/研究种子/观察分支”状态。

当网页预算不少于 3 个主题查询、直连预算不少于 3 个可查询任务时，选择器固定给正式主题、独立分支和研究种子各保留一个机会；余下容量仍按领域轮转。这个规则保证“发现分支/新方向”不是排在任务列表末尾的偶然事件，但不保证来源一定有合格结果。无结果是合法的 no-change，不会被补写成 Evidence。

第二条命令在每轮 Agent 循环中生成同一类覆盖计划，并将受限查询交给外部检索适配器。结果始终为 `context_only` 线索。

对于明确支持主题检索且允许自动调用的公开 API，系统还会生成：

```text
outputs/research/latest_direct_source_research.json
outputs/research/latest_direct_source_research.md
```

当前已实现 ClinicalTrials.gov、PubMed、Europe PMC、Crossref、OpenAlex、arXiv、GitHub、Hugging Face、SEC EDGAR 全文检索和美国联邦公报 Documents API。直接 API 的查询预算独立于网页检索；系统在正式主题、研究种子和分支之间轮转，并在 6 小时窗口轮换研究种子。已有阶段的正式主题保留固定覆盖位，策展的 S0 核心主题在剩余正式位中轮换。报告只记录真正执行的按词查询；存在于来源目录、但不接受该主题词的静态 API 不会被记成失败。每条记录保留来源 URL、标题、有限的 API 摘要和发布时间。服务端全文命中只表示可以进一步检查，不能单独证明相关性：一般来源的标题必须复现本次任务的主题词或明确缩写。SEC EDGAR 还会优先将任务定向到关联的美国公司；其紧凑表单标题只有在同时命中关联美国公司且披露摘要复现主题时才进入待审核队列。没有可见主题上下文的历史披露会被排除。它不是正式 Evidence；若没有经过人工确认，不会导入、不会升级 Stage，也不会更新 Score。

在分诊之后，可用 `npm run research:retrieve -- --max 6` 为有限条 `priority_review` / `review` 的官方、公司原始或学术来源建立原文取证包。该步骤保留原始 URL 和内容指纹，只保存最多三段有限摘录；ClinicalTrials 使用公开结构化研究记录，arXiv 提取论文摘要，通用 HTML 排除导航、页脚和脚本。取证包只让研究者看到可复核正文，不能创建 Evidence、修改命名登记、改变 Stage/Score 或将分支材料提升为父主题材料。

每轮外部检索会保留一小部分容量，查询已绑定 Topic 的公司官网/IR 域名。公司查询保留原有 Topic/Branch scope，返回结果同样只是 `context_only`；它不能自动补充证据链、升级父主题或绕过人工审核。

研究种子在直连 API 报告中保留 `candidate_node_id`。进入 Intake 后，它只能形成 `provisional_*` 的 S0 候选，不能回落为 `unknown_topic`，也不能继承既有主题的阶段或把任何分支变化传给父主题。

## 线索分诊

`latest_lead_triage` 是一个只读的规则化审查顺序，不是证据或自动化结论。它合并 `latest_web_research` 与 `latest_direct_source_research`，为每条保留线索记录来源类别、可见主题相关性、发布时间、新鲜度、同 scope 重复记录、分诊理由和下一步核验方式。状态仅有“优先核验、常规核验、参考资料、暂缓”。

同一 URL 只有在同一 Topic/Branch/seed scope 才会合并；相同页面在父主题和分支各自保留一条观测，不能把分支材料算作父主题支持。研究种子仍只是 provisional 候选。分诊不会创建 Evidence Candidate、不会写 Registry、不会自动导入、不会改变 Data Confidence、Stage 或 Score。研究者必须打开原始页面，确认原文引用和 scope，再走现有 Intake、Resolver、去重与 Evidence Gate。

## 外部检索配置

DeepSeek 或任何 OpenAI-compatible 模型仅负责候选解析，不提供网页浏览。默认的 `free` provider 无需密钥，会以有限、尽力而为的方式聚合公开索引，用于发现线索而非原始页面取证。需要受治理的来源页检索时，可单独配置：

```bash
NARRATIVE_WEB_SEARCH_PROVIDER=mcp_bridge
NARRATIVE_WEB_SEARCH_ENDPOINT=https://your-search-bridge.example/search
NARRATIVE_WEB_SEARCH_API_KEY=optional-secret
```

MCP Bridge 接收 `query`、`max_results` 和可选 `domains`，返回 `results[]`。密钥不写入 artifact。也可使用 Brave 或 Tavily 适配器。服务不可用、超时或返回不合规时，系统写入 `unconfigured/degraded` 状态，不会伪造线索或触发证据导入。

## 自迭代边界

- Agent 能自动创建研究任务、累积来源支持、创建 provisional Topic 或 watch Branch，并在既有独立来源政策满足时激活图谱节点。
- Agent 不能把研究种子直接变成 active Topic，不能凭搜索摘要写入正式 Evidence，不能修改 Stage、Score 或规则。
- 分支始终以 branch scope 积累，不能升级整体主题。
- Narrative Memory 先于“新主题”判断运行；未解析、提示词残留和非市场名称会被拦截。
- 一切阶段变化仍遵守 Evidence Table、Stage First、Score Second 与 research-only 边界。

## 接入优先级

优先接通已经有清晰公开 API 与条款的来源，例如 SEC EDGAR、ClinicalTrials.gov、Crossref、World Bank、UN Comtrade、WHO、NASA，以及已有的中国政府政策与交易所公告连接器。只有可以接收“本次主题检索词”的 API 才能成为定向连接器；静态疫情、灾害或固定公司端点不能仅因领域标签相同就附着到某一主题。需要密钥、参数、许可或反爬限制的来源保留为计划或人工复核来源，不能假设可以自动抓取。
