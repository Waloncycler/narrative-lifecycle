# Narrative Lifecycle Dashboard - 项目进度与阶段成果报告

> **项目名称**：叙事生命周期仪表盘 (Narrative Lifecycle Dashboard)  
> **文档版本**：v1.0.0  
> **更新时间**：2026年7月28日  
> **项目状态**：核心引擎已就绪 / 数据源能力目录与首批公开来源已接入 / 自动正式导入仍禁止  

---

## 一、 项目总体进度概览

| 阶段 / 里程碑 (Milestone) | 目标描述 | 当前状态 | 完成度 | 关联规范/代码路径 |
| :--- | :--- | :---: | :---: | :--- |
| **M1: 叙事生命周期理论与定量框架** | 建立 S0-S7 生命阶段定义、评分引擎、证据表规范与防跑偏规则 | **已完成** | 100% | `docs/01`~`06`, `25_quantitative_framework` |
| **M2: 证据链与核心计算引擎** | 实现 Evidence Table 存储、阶段分类器、增量更新与 Dashboard Card 生成器 | **已完成** | 100% | `src/domain/`, `src/services/` |
| **M3: Intake 材料智能解析与审查防线** | 搭建材料拆解、引用溯源、规则+AI Shadow 双轨生成与 Operator 审查闸门 | **已完成** | 100% | `docs/24`, `src/types/intake.ts` |
| **M4: World Monitor Source Operations** | **盘点 OpenAPI 能力，接入公开上游并统一进入 Intake 审核** | **接入、治理与变化闭环完成，来源扩展持续进行** | 90% | `docs/27`, `docs/29`, `src/infrastructure/worldmonitor_source_adapter.ts` |
| **M5: 实时数据流对接与自动 Intake 运行** | 对接真实 API (GDELT, FRED, PortWatch, EIA等) 实现定时拉取与增量候选生成 | **规划中** | 20% | 下一阶段重点 |
| **M6: 前端可视化与多维叙事树仪表盘** | 构建交互式叙事树、早期雷达、多源信号热力图与跨域联动面板 | **规划中** | 15% | 下一阶段重点 |

---

## 二、 核心架构与叙事 7 大层级映射体系

项目采用**模块化单体架构 (Modular Monolith)**，将市场叙事划分为 **7 大核心生命周期层级**。外部来源只提供候选事实和层级提示，不允许直接映射或绕过事实级审核：

```text
               ┌──────────────────────────────────────────────────────────┐
               │         叙事生命周期仪表盘 (Narrative Lifecycle)         │
               └────────────────────────────┬─────────────────────────────┘
                                            │
   ┌──────────────┬──────────────┬──────────┴───┬──────────────┬──────────────┬──────────────┐
   │              │              │              │              │              │              │
┌──▼──┐        ┌──▼──┐        ┌──▼──┐        ┌──▼──┐        ┌──▼──┐        ┌──▼──┐        ┌──▼──┐
│ 名  │        │ 资  │        │定价 │        │ 实  │        │ 势  │        │阻力 │        │置信 │
│Perception    │Capital       │Pricing       │Reality       │Momentum      │Friction      │Confidence
└──┬──┘        └──┬──┘        └──┬──┘        └──┬──┘        └──┬──┘        └──┬──┘        └──┬──┘
   │              │              │              │              │              │              │
 媒体/RSS       股票/量价      期货曲线       物理运量       跨源联动       制裁/阻断      数据源
 GDELT/社交     板幅/COT       预测市场       EIA/海关/火点   AI关联引擎     断网/GPS干扰   溯源评分
```

---

## 三、 本阶段完成的核心成果 (Milestone 4: World Monitor Source Operations)

### 1. 全量数据源清单与 5 大领域分类
通过 35 份 OpenAPI 合约梳理 `worldmonitor-main` 的 **199 个 operation**。另有 8 个公开 JSON 上游可直接运行；其余来源按 Key、参数、许可和兼容状态逐项开放：

1. **地缘政治、武装冲突与军事情报 (Geopolitics & Military)**：
   - ACLED 冲突事件、UCDP 数据库、GDELT 全球新闻与 QuadClass/Goldstein 评分、军事基地部署与兵力涌动、OpenSky/ADS-B 军用侦察机与加油机跟踪、海军航母/潜艇部署、以色列 OREF 防空警报、防务采购招标 (SAM.gov / TED EU)、OFAC/FATF 制裁名单。
2. **金融市场、宏观经济与情绪指标 (Financial & Macro)**：
   - 全球主要股指与板块宽度 (Finnhub)、海湾 GCC 市场 (TASI/DFM/ADX)、大宗商品期货 (WTI/Brent/TTF/黄金/铜)、美联储 FRED 宏观利率与收益率曲线、IMF WEO GDP 预测与黄金储备、世界银行 WDI 外部债务与进口集中度 (HHI)、BIS 国际结算银行信贷缺口、Eurostat 工业生产、中国 PBOC 政策利率/社融 (TSF)、CFTC COT 期货持仓、AAII/Fear&Greed 情绪指标、加密货币/稳定币流动性、Polymarket 预测市场概率。
3. **能源、供应链与海事跟踪 (Energy & Supply Chain)**：
   - AISStream 实时船只 AIS 跟踪、IMF PortWatch 关键海峡 (苏伊士/霍尔木兹/曼德海峡/巴拿马) 航运量与中断风险、US EIA 原油库存/SPR/炼厂利用率、IEA/JODI 全球石油天然气库存、AGSI+ 欧洲天然气储气率、欧洲电价与发电机组、GEM 管道与储罐设施、UN Comtrade 关键矿产 (锂/钴/稀土/半导体) 双边海关贸易额、FAO 全球食品价格指数。
4. **航空、基础设施与卫星遥感 (Aviation & Remote Sensing)**：
   - AviationStack 全球航班延误与空域关闭 (NOTAM)、GPSJAM 电子战干扰热点、Cloudflare Radar 海底光缆与国家级断网告警、NASA FIRMS 卫星热异常/爆炸点、USGS 地震与 NOAA/ReliefWeb 气象灾害、WHO DON 流行病爆发告警、EURDEP 辐射监测。
5. **新闻、社交媒体与情报聚合 (OSINT & AI Synthesis)**：
   - 200+ 重点媒体 RSS 源、Telegram 军事与地缘 OSINT 频道、Reddit/WSB 帖子声量与情绪、World Monitor AI 多源关联引擎 (Groq/OpenRouter)。

### 2. 软件代码与接入服务实现
- **[docs/27_worldmonitor_data_sources_integration_map.md](file:///Users/walox/Documents/narrative-lifecycle/narrative-lifecycle-dashboard-handoff-v0.1/docs/27_worldmonitor_data_sources_integration_map.md)**：完成了全量数据源规范与 7 层映射文档。
- **[src/types/worldmonitor_adapter.ts](file:///Users/walox/Documents/narrative-lifecycle/narrative-lifecycle-dashboard-handoff-v0.1/src/types/worldmonitor_adapter.ts)**：定义了标准信号 `WorldMonitorSignal` 与适配器类型体系。
- **`src/infrastructure/worldmonitor_source_adapter.ts`**：实现 OpenAPI 目录、公开来源 HTTP 适配、权限状态、payload hash 与同步持久化。
- **`src/application/use_cases/sync_worldmonitor_sources_use_case.ts`**：实现有界候选生成、重复抑制、引用检查、Topic Resolver 与人工审核编排。
- **Source Governance Contract**：逐 operation 记录授权状态、归属、再分发边界、敏感性、原始数据保留、时效窗口和自动轮询许可；未达到 `research_ready` 时 fail closed。
- **Source-Specific Normalizers**：USGS、EONET、GDACS、NWS、WHO、Treasury、CFTC 和 World Bank 使用版本化专属解析，区分事件时间与可获得时间，并输出详情 URL、metrics、location 和可读事实摘要。
- **Source Change Research Loop**：Fact State 区分新增、修订、无变化与未观察；仅变化事实进入审核，并以 Session、Topic Audit、Import、Evidence IDs 和 Weekly Run 建立闭环关联。
- **[docs/legacy_service_inventory.json](file:///Users/walox/Documents/narrative-lifecycle/narrative-lifecycle-dashboard-handoff-v0.1/docs/legacy_service_inventory.json)**：在服务架构目录中完成了注册。

---

## 四、 质量保障与测试验证状态

代码库保持极高的工程质量与严密测试覆盖：

```bash
> narrative-lifecycle-dashboard@0.1.0 test
> vitest run

 Test Files  63 passed (63)
      Tests  226 passed (226)
```

1. **类型安全 (Type Safety)**：`npm run typecheck` (tsc --noEmit) 干净通过，无任何 TypeScript 编译错误。
2. **单元测试 (Unit Tests)**：全量测试套件 **63 个测试文件、226 个测试用例 100% 通过**，覆盖 source inventory、专属 normalizers、Fact State、来源重要性阈值、变化幂等、Weekly 失败恢复、Evidence 合并、Session 因果隔离、sandbox/live 隔离、引用位置、无 Key 回退和 Topic Gate。
3. **架构边界约束 (Architecture Boundaries)**：验证了严格的分层设计，没有任何逻辑越界或非法依赖。

---

## 五、 下阶段计划与路线图 (Next Action Items)

| 序号 | 任务模块 | 具体内容 | 预计交付时间 |
| :---: | :--- | :--- | :---: |
| 1 | **扩展公开数据 API 连接器** | 首批 USGS、EONET、GDACS、NWS、WHO、Treasury、CFTC、World Bank 已完成；继续增加来源专属 normalizer | Week 1 |
| 2 | **定时拉取与候选增量生成** | 编写定期 Cron 任务脚本，自动将拉取的信号转化为 `EvidenceCandidate` 并写入待审查队列 | Week 1 - 2 |
| 3 | **审查面板与叙事树图谱** | 在前端面板中展示多源情报热力图与跨域叙事推演树，辅助研究员高效审核 | Week 2 - 3 |
