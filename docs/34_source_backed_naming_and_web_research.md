# 来源支持的命名与外部研究

## 目的

主题、子主题和分支显示给研究者的名称必须优先采用市场通行的中文名称，不能把内部 `topic_id`、模型临时标签或英文 slug 伪装成市场共识。外部检索用来补齐覆盖缺口、寻找一手来源和核验命名；它不是正式 Evidence 的快捷通道。

## 命名规则

每个登记节点可包含：

- `market_name_zh`：面向研究者的中文名称。
- `market_name_en`：跨语言检索与别名使用的英文名称。
- `naming_status`：`verified`、`provisional` 或 `unresolved`。
- `naming_sources`：来源名称、URL、可得日期和原文用名。

只有同时具备中文名称、`verified` 状态和至少一条可访问来源的节点，才可由自动图谱提升流程激活。新发现方向默认为 `unresolved`，即便累计了两条 Evidence，也会因“名称未核验”暂停，而不是用系统自己生成的名字进入主题列表。

`topic_id` 和 `branch_id` 仍是稳定机器标识，不能因显示名变化而重写。别名登记表保留中文、英文、缩写和历史表达，以便同一主题跨语言归并。

## 外部检索

运行：

```bash
npm run research:search -- --topic bci
npm run research:search -- --query "脑机接口" --query "brain computer interface"
```

输出：

- `outputs/research/latest_web_research.json`
- `outputs/research/latest_web_research.md`
- `outputs/research/history/<research_id>.json`

Agent 的 `research` 阶段也会运行一小批活跃主题检索。检索产物中每一项都是 `context_only`：保留查询、URL、标题、摘要、域名、时间和下一步核验动作，但**不能**自动创建 Evidence、导入 Evidence、激活主题、升级阶段或参与评分。

配置在进程环境中完成，密钥不会写入任何 artifact：

```bash
# Brave
NARRATIVE_WEB_SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=...

# Tavily
NARRATIVE_WEB_SEARCH_PROVIDER=tavily
TAVILY_API_KEY=...

# 自建 MCP / 检索网关；密钥可选
NARRATIVE_WEB_SEARCH_PROVIDER=mcp_bridge
NARRATIVE_WEB_SEARCH_ENDPOINT=http://127.0.0.1:8787/search
NARRATIVE_WEB_SEARCH_API_KEY=...
```

MCP Bridge 接收：

```json
{"query":"脑机接口","max_results":5}
```

并返回：

```json
{"results":[{"title":"...","url":"https://...","snippet":"...","source_name":"...","published_at":"2026-08-03T00:00:00Z"}]}
```

没有配置时状态为 `unconfigured`。配置错误、超时或限流时状态为 `degraded`；既不会复用旧摘要，也不会把失败当作“没有新事实”。`gdelt` 是可显式选择的无密钥适配器，但可能被上游限流，因此不作为默认生产搜索服务。

## 从线索到正式状态

```text
检索线索（context_only）
→ 打开原始来源并确认引用
→ Topic / Alias / Branch / Narrative Memory 核验
→ Evidence Candidate
→ 人工或受控发布策略
→ Schema + 去重 + Parent/Branch Gate
→ Evidence Table
→ Stage Gate
→ Score / Diff / Weekly
```

任何一步失败都只会暂停或进入审核队列。分支材料保持 `branch` scope，不能补足父主题的定价或现实门槛。

## 脑机接口基线

`data/imports/bci_market_baseline_2026_08.yaml` 是一次经来源核对后的正式基线导入：

- 工信部等七部门的实施意见确认“脑机接口”为稳定中文产业主题名称。
- Synchron 的公开融资公告提供整体主题的资本确认。

这两条父主题 Evidence 使整体“脑机接口”达到 `S4`。当前仍缺整体主题的定价采用与硬现实 Evidence，因此不能升至 `S5` 或 `S6`。医疗康复分支即使后续出现注册、价格或临床材料，也必须单独积累，不能越过父主题边界。
