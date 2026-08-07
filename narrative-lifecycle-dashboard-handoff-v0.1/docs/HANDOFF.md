# Narrative Lifecycle Dashboard 交接文档

> 更新日期：2026-08-04
> 项目根目录：`/Users/walox/Documents/narrative-lifecycle/narrative-lifecycle-dashboard-handoff-v0.1`
> 当前里程碑：`v0.13.3-research-lead-triage`
> 最近验证：`85` 个测试文件、`375/375` 测试通过；`npm run typecheck`、`evidence:validate`、`weekly`、`review` 通过。

本文件交给下一位模型或工程师。先读本文件，再读 `AGENTS.md`、`README.md`、`PLANS.md`，最后按需阅读 `docs/30`、`32`、`34`、`35`。

## 1. 项目是什么

这是一个 Evidence-first 的叙事生命周期研究系统。它把材料转为可追溯 Evidence，分别判断父主题与分支主题，经由确定性的 Stage Gate、Data Confidence、Score、Diff、Weekly Brief 和历史复盘，形成研究监控闭环。

它不是交易系统。不得输出买卖、仓位、目标价、进出场、收益承诺或任何执行建议。允许的研究动作只有 observe、wait、validate、review、monitor、flag_risk 及其中文等价表达。

## 2. 不可突破的规则

以下规则优先级最高，不能被 UI、提示词、搜索结果、Agent、导入脚本或测试捷径绕过：

1. Stage First, Score Second。
2. 没有 Evidence Table，不得评分。
3. LLM/Agent 只能提出候选，不能直接决定 Stage 或 Score。
4. 无稳定名称不得高于 S2；无资本确认不得高于 S3；无定价采纳不得高于 S4；无硬现实验证不得高于 S5。
5. 父主题与分支必须使用各自 scope 的证据集。分支证据永远不能抬升父主题。
6. Narrative Memory 必须先于“新主题”判断；旧主题没有 material Narrative Delta 不进入 Early Radar。
7. 缺数据降低 Data Confidence，不等同于负面证据。
8. 每张 Dashboard Card 必须有 `why_not_higher_stage`。
9. 所有稳定 artifact 必须可追溯、带版本或 run context；历史运行不得被重写。
10. BCI 父主题保持 S4；医疗康复分支可高于父主题，但不得使 BCI 父主题被判作 S6。

权威规则来源是 `AGENTS.md`。若实现、文档、提示词或测试与它冲突，先停下并做显式治理决策，不要悄悄扩大自治权限。

## 3. 当前真实状态

| 能力 | 状态 | 说明 |
|---|---|---|
| Stage Gate、评分、Golden Cases | 可用 | 规则化、schema 校验、回归测试覆盖。 |
| Evidence Import、Pipeline、Weekly、Review | 可用 | 运行历史不可变，`latest` 仅为便利指针。 |
| Parent/Branch、Memory、Reactivation、Early Radar | 可用 | 规则与 Golden Cases 覆盖。 |
| Intake Workbench | 可用 | TXT/MD/HTML/DOCX/文本型 PDF 与粘贴文本；无 OCR。 |
| OpenAI-compatible Intake Agent | 可用 | DeepSeek 可经环境变量接入；输出仍须经过规则、引用、Topic/Branch 和证据门。 |
| Topic/Branch Discovery、Provisional/Watch 图谱 | 可用但需治理 | 能发现与累积候选，名称、独立来源和 scope 门槛不可省略。 |
| 来源覆盖计划 | 可用 | 43 个来源能力目录、40 个研究种子、30 家跨市场公司核验目标。 |
| 公共直连 API | 部分接通 | 详见第 7 节；结果仅为 `context_only`。 |
| 通用网页搜索 | 可用但有限 | 默认 `free` 聚合公开索引；结果仅为 `context_only`，受治理的来源页检索仍需 Brave、Tavily 或 MCP Bridge。 |
| OCR、数据库、认证、完整 SaaS Dashboard | 未做 | 不得伪装成已完成。 |

最近一次来源任务的实际结果应从 `outputs/research/latest_campaign.json`、`outputs/research/latest_direct_source_research.json` 和 `outputs/research/latest_lead_triage.json` 读取，不要硬编码本文数字。2026-08-04 本次验证：60 个任务、35 个来源目标；12 个网页查询得到 62 条线索，8 次直连查询得到 4 条线索；分诊后有 6 条优先复核、14 条常规复核、27 条背景参考、19 条暂缓。网页查询实际覆盖正式主题、分支、研究种子和暂定主题；分支和种子仍保持独立 scope。

## 4. 代码架构和入口

```text
src/domain/          纯业务规则：Evidence、Stage、Score、Memory、Diff、Resolver、Discovery
src/application/     Use Case 编排和 ports
src/infrastructure/  文件、YAML、AJV、原子写入、provider、repository 实现
src/interface/       HTML renderer、HTTP server、view model
src/cli/             薄 CLI，只调用 Use Case
src/types/           Domain/Persistence/Public Artifact 类型
src/services/        遗留兼容层；新逻辑不要继续放入这里
```

关键 composition root：

- `src/infrastructure/file_system_adapters.ts`
- `src/interface/interactive_intake_server.ts`
- `src/interface/narrative_monitor_renderer.ts`

Domain 与 Application 禁止依赖 `fs`、`path`、YAML、`process.env`、CLI argv 或 `outputs/`。相关架构边界测试已存在。

## 5. 核心数据与 artifact

| 数据 | 位置 | 用途 |
|---|---|---|
| 正式/样例 Evidence | `data/live_evidence/`、`data/sample_evidence/` | Evidence Table 输入。 |
| 手工导入与审计 | `data/imports/`、`data/audit/` | 可回溯导入和拒绝记录。 |
| Topic、Alias、Branch、Provisional Registry | `data/topic_registry/` | Parent-first 解析、命名和分支治理。 |
| Narrative Memory | `data/topic_registry/` 与对应领域数据 | 防止旧主题被误判为新主题。 |
| 来源能力目录 | `data/source_atlas/authoritative_sources.yaml` | 能力与连通性分离。 |
| 研究主题种子 | `data/research_universe/core_topics.yaml` | 40 个市场常用名称的候选研究方向。 |
| 公司核验目录 | `data/company_registry/core_companies.yaml` | 30 家中港美及全球公司的官网/IR 与披露通道映射。 |
| JSON Schema | `schemas/` | 所有输入、公开 artifact、registry、研究报告。 |
| 当前研究计划 | `outputs/research/latest_campaign.json` | 可执行覆盖任务，不是 Evidence。 |
| 直连来源线索 | `outputs/research/latest_direct_source_research.json` | `context_only`，保留 URL 和摘要。 |
| Intake artifacts | `outputs/intake/` | 原文、候选、复核、Agent audit、学习反馈。 |
| 不可变 Run History | `outputs/runs/<run_id>/` | manifest、snapshot、diff、weekly brief。 |
| 运营运行产物 | `outputs/operator_runs/` | 当前 operational snapshot、diff、brief。 |
| 历史复盘 | `outputs/reviews/` | 只读聚合，不重新分类。 |

稳定 public artifact 要具备：`artifact_type`、`schema_version`、`producer_version`、`rule_version`、`run_id`、`generated_at`。先用 schema 校验，再读数据。

## 6. 标准运行手册

在项目根目录执行：

```bash
npm install
npm run typecheck
npm test
```

日常只读/研究流程：

```bash
npm run evidence:validate
npm run topic:validate
npm run research:baseline
npm run research:campaign -- --max-tasks 24 --max-queries 12
npm run research:triage
npm run research:retrieve -- --max 6
npm run weekly
npm run review
```

`weekly` 会写入新的不可变 run；`review` 只读 run history 并生成新的 review artifact。不要为了查看文档而运行它们。

手工 Evidence 导入流程：

```bash
npm run intake:prepare -- --file data/intake/examples/bci_branch_note.md
npm run topic:validate
npm run intake:apply -- --decisions outputs/intake/latest_review_decisions.yaml
npm run intake:evaluate -- --decisions outputs/intake/latest_review_decisions.yaml
```

本地工作台：

```bash
npm run intake:workbench -- --port 4188
```

访问 `http://127.0.0.1:4188/`。重点路由：`/topics`、`/queue`、`/intake`、`/agent`、`/sources`、`/system`、`/governance`。修改 server renderer 后必须重启该进程，不能假设静态 TypeScript 会热重载。

## 7. 来源、公司与检索状态

### 已登记的来源能力

`data/source_atlas/authoritative_sources.yaml` 当前有 43 个来源，覆盖中国政策与监管、中国/香港交易所披露桥、SEC、Federal Register、国际组织、临床/论文/工程索引和公司披露。目录中的来源不等于已抓取、已授权或已配置。

目前能按主题词执行公共直连查询的适配器包括：ClinicalTrials.gov、PubMed、Europe PMC、Crossref、OpenAlex、arXiv、GitHub、Hugging Face、SEC EDGAR、Federal Register。

SEC/Federal 及其他直连结果的强约束：

- 返回结果只是 `context_only`，不自动进入 Evidence Table。
- 一般来源的可见标题必须复现主题词或明确缩写。
- SEC 的紧凑表单标题还必须同时匹配关联美国公司，且其可见文件描述复现主题。
- 服务端全文索引命中本身不是相关性证明；未来日期和交易建议语言被拒绝。
- 短暂的 429/500/502/503/504 会重试一次；再次失败如实记录为 `degraded`。

`data/company_registry/core_companies.yaml` 含 30 个核验目标，包括华为、阿里、腾讯、百度、中芯、宁德时代、恒瑞、英伟达、AMD、微软、Alphabet、特斯拉、礼来、艾伯维等。公司页面只提供定向检索约束，不能成为主题热度、买卖清单或 Stage 依据。

### 尚未接通的关键能力

中国监管机构、上交所、深交所、港交所等有些仅登记为 `search_bridge` 或 `rss_or_html` 能力，尚没有统一的、已配置的生产检索/抓取连接器。下一步应接通合法、可审计的 MCP/Web Search Bridge 或各站点专用 adapter，并保留条款、freshness、来源 URL、原始引用位置和失败状态。

免费网络搜索（无需任何 key，开箱即用）：

- `free`（默认，未配置任何 key 时自动启用）：聚合 GDELT + Wikipedia(zh/en) + Hacker News + DuckDuckGo Instant Answer + Reddit + arXiv + OpenAlex + Internet Archive，按 URL 去重并**跨源轮转混排**（否则某个先返回的源会挤掉其他源，导致每 query 只来自单一来源）。
- 单独使用任一免费源：`NARRATIVE_WEB_SEARCH_PROVIDER=gdelt | wikipedia | hn | duckduckgo | reddit | arxiv | openalex | archive`。
- `NARRATIVE_WEB_SEARCH_MAX_RESULTS`（默认 8，上限 20）控制每 query 结果量；`NARRATIVE_WEB_SEARCH_TIMEOUT_MS` 控制超时。
- 免费源偶发 429/5xx 自动重试一次；`free` 聚合中单个源失败不影响其他源。`zh.wikipedia.org`、`reddit.com`、`archive.org` 在当前网络环境可能被阻断/限流，聚合会自动容错并保留其他源结果；OpenAlex 的 DOI 若已是完整 URL 不会重复加前缀；非 ASCII URL（如中文维基）会按 RFC 3986 规范化再入库，保证 schema `uri` 校验通过。
- `research:campaign` 集成：topic 宽网查询使用英文主题词（混合中英文或"官方/政策"长尾词会让免费源失配），不继承权威域名白名单（定向检索由 direct source research 承担）；查询以小并发（3）执行，避免多 query 突发触发免费源限流。实测一次 campaign：12 个查询 → 64 条多源 lead（Wikipedia/HN/DDG/OpenAlex/arXiv）。

有 key 时的付费/免费额度备选：

```text
NARRATIVE_WEB_SEARCH_PROVIDER=tavily          # 配 TAVILY_API_KEY
NARRATIVE_WEB_SEARCH_PROVIDER=brave           # 配 BRAVE_SEARCH_API_KEY
NARRATIVE_WEB_SEARCH_PROVIDER=mcp_bridge      # 配 NARRATIVE_WEB_SEARCH_ENDPOINT
```

显式禁用：`NARRATIVE_WEB_SEARCH_PROVIDER=disabled`。搜索结果始终是 `context_only`，不能直接成为 Evidence。

## 8. Agent 与自治边界

Intake Agent 使用 provider-neutral OpenAI-compatible 接口，入口：

- `src/domain/intake_agent_prompt.ts`
- `src/infrastructure/intake_agent_provider.ts`
- `src/domain/intake_agent_rules.ts`

可使用的环境变量包括：

```text
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL
DEEPSEEK_MODEL
NARRATIVE_AGENT_PROVIDER
NARRATIVE_AGENT_ENDPOINT
NARRATIVE_AGENT_API_KEY
NARRATIVE_AGENT_MODEL
NARRATIVE_AGENT_TIMEOUT_MS
```

不要把密钥写入 YAML、JSON、日志或 artifact。模型输入输出和人工决策可以审计，但要做密钥脱敏。

Agent 必须输出原文引用与位置、事实/解释/限制区分、Topic/Branch/Scope、E0-E4、affected layers、置信度、不确定项和替代映射。模型失败、超时或 schema 不合法时必须退回 rule-based candidate。

### 需要先解决的治理冲突

`AGENTS.md` 明确要求：自迭代只能利用版本化人工反馈作为 advisory context，不得静默修改规则、registry、Stage、Score 或 import 权限。

但是当前部分实现与测试含有 `autonomous` 路径，例如 `src/domain/intake_learning.ts` 的 profile、`src/application/use_cases/intake_use_cases.ts` 的自动处理注释，以及 Topic/Branch promotion 流程。它们与旧文档中的“human review”表述也不完全一致。

下一位模型在扩展自治前必须：

1. 把“候选生成”“provisional/watch 注册”“正式 Evidence 发布”“active Topic 激活”“Stage 更新”“规则学习”拆成独立权限。
2. 将每项权限与 `AGENTS.md` 逐条对齐，更新 types、schemas、测试、UI 和文档。
3. 默认 fail closed：来源、引用、名称、scope、独立来源或 policy 不满足时只进入 queue，不进入正式状态。
4. 不能以“用户想完全自动”为理由绕过 Evidence Table、Stage Gate、Parent/Branch 或 research-only 边界。

在该冲突解决前，不应把现有自治流程宣传为无人监管的生产自动化。

## 9. Golden Cases 与当前验收

必须持续通过：

| Golden Case | 必须保持的判断 |
|---|---|
| BCI / 脑机接口 | 父主题 S4；医疗康复分支可为 S5-S6；分支不得把父主题抬升至 S6。 |
| 人形机器人 | S5-S6，保留 S7A/S7C 潜力与 S7B 拥挤风险。 |
| 创新药 License-out | S5-S6；区分 headline value、upfront、milestones、监管与实际兑现。 |

本次交接已执行：

```text
npm test                    84 files / 368 tests passed
npm run typecheck           passed
npm run evidence:validate   passed (accepted 1, rejected 0)
npm run topic:validate      passed
npm run research:campaign   completed; web search unconfigured, direct leads context-only
npm run weekly              passed
npm run review              passed
```

最新 run/review ID 以 `outputs/runs/latest_run.json` 和 `outputs/reviews/latest_operator_review.json` 为准，不能以本文日期或示例 ID 判断新鲜度。

## 10. 接下来最值得做的事

按顺序推进：

1. 先解决第 8 节的自治治理冲突，明确允许哪些自动动作，其他全部 fail closed。
2. 配置合规的 MCP/Web Search Bridge，先做结果 schema、域名 allowlist、条款/限流、引用位置和故障审计，再接中国监管、交易所和公司 IR 检索。
3. 建立冻结的真实文档评估集：至少覆盖中英文、政策、交易所披露、公司 IR、监管批准、科技公司新闻、多事实材料、重复、旧主题再激活、新主题和新分支。
4. 以人工复核结果校准 Agent：citation accuracy、unsupported claim、Topic/Branch accuracy、E3/E4 overstatement、review time、duplicate prevention。未达到门槛时只改提示/候选排序，不改 Stage 规则。
5. 扩展公司 registry 和主题 universe 时，先添加 schema fixture、命名来源和关联证据层，再添加 UI 展示；不得用公司名直接推导主题阶段。
6. UI 只显示“已发生 / 等待审核 / 尚未配置”的真实状态，遵守 `docs/23_ui_design_system.md`，避免原始 ID、英文术语或假自动化。

## 11. 工作区注意事项

当前 worktree 很脏，包含大量用户已有的未跟踪数据、运行 history、前序开发文件和最新 artifact。不要执行 `git reset --hard`、`git checkout --` 或批量删除 `outputs/`。先用 `git status --short` 确认范围，只编辑与当前任务直接相关的文件。

每次改动后至少运行相关 Vitest；跨 Domain、registry、schema 或 Intake 流程的改动需运行：

```bash
npm run typecheck
npm test
```

涉及真实运行或 artifact contract 时，再按第 6 节运行验证命令并在交接记录中说明哪些输出被写入。
