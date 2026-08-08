<div align="center">

# 市场叙事生命周期研究系统
### Narrative Lifecycle Dashboard & Research Engine

**一个基于“名、资、实、势”与确定性状态机的二级市场叙事生命周期量化研究系统。**

[![CI](https://github.com/Waloncycler/narrative-lifecycle/actions/workflows/ci.yml/badge.svg)](https://github.com/Waloncycler/narrative-lifecycle/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Theory Version](https://img.shields.io/badge/Theory%20Manuscript-v1.0-darkgreen.svg)](docs/theory/市场叙事生命周期理论_第一版.md)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)](CONTRIBUTING.md)

[项目初衷](#一为什么做这个项目-why-this-project-exists) · [理论体系](#二什么是叙事生命周期理论-narrative-lifecycle-theory) · [快速上手](#三快速上手-quickstart) · [系统架构](#四系统架构与数据流-architecture--data-flow) · [命令索引](#五全流程运行指南-run-the-system) · [开源共建](#六开源共建与路线图-contributing--roadmap)

</div>

---

> ⚠️ **严正声明 / Research Disclaimer**  
> 本项目为**纯粹的学术与产业研究工具**，绝非自动化交易系统，不生成任何形式的买卖信号、投资建议或价格预测。外部情报源数据仅在内存中进行特征提纯与摘要核验，不留存未经授权的原始 Payload。

---

## 一、为什么做这个项目？ (Why This Project Exists)

### 1.1 二级市场深层的“名实之惑”

在二级市场的投资与研究实践中，我们经常观察到一个看似矛盾却无处不在的现象：

- **同样一份重磅订单**：在某些时刻能成为连续涨停的催化剂，在另一些时刻却被市场彻底无视；
- **同样一项前沿突破**：有时被迅速赋予“第四次工业革命”的史诗级叙事，有时仅仅沦为研报角落里的一日游新闻；
- **同样一份国家级政策文件**：有时能催生横跨数月的产业主线，有时却停留在公告发布当天的冲高回落。

传统的研究范式往往陷入两种极端：
1. **纯基本面/事实派**：执着于“事实强不强”，但往往发现现实数据兑现之时，股价早已见顶（利好出尽）；
2. **纯情绪/量价派**：执着于“热度高不高、讨论多不多”，但往往把短期噪音误判为主线，在概念退潮时遭遇流动性踩踏；
3. **黑盒大模型派**：将海量新闻喂给 LLM 让其直接输出“打分或看好程度”，缺乏因果证据链，幻觉严重且无法复盘校验。

### 1.2 核心认知：二级市场交易的是“认知的状态跃迁”

这个项目的起点，建立在对市场微观本质的一个根本判断之上：

> **二级市场真正交易的，不是事实本身，也不是故事本身，而是市场共同认知从一个状态跃迁到下一个状态的概率 $P(S_i \to S_{i+1})$，以及这种跃迁能否引发资本配置与现实验证的正反馈。**

投资者的核心超额收益（Alpha），并不来自所有人都看懂事实后的平庸确认，而是在**共同认知发生跃迁的前夕**，识别出推动跃迁的动力、阻力与证据闭环。

为此，我们构建了 **Narrative Lifecycle（叙事状态变化识别系统）**：
- 它不是热点榜，不是打分黑盒，而是一台**严谨、透明、确定性的叙事状态机**；
- 贯彻坚定的第一性原则：`Evidence first. Rules second. LLM explanation third.`（证据第一，规则第二，大模型解释第三）。

---

## 二、什么是叙事生命周期理论？ (Narrative Lifecycle Theory)

完整理论手稿详见：📖 [《市场叙事生命周期理论 · 第一版》(Markdown 全文)](docs/theory/市场叙事生命周期理论_第一版.md) / 📕 [PDF 原版文档](docs/theory/市场叙事生命周期理论_第一版.pdf)。

### 2.1 四层演化架构：名、资、实、势

理论将叙事的宏观演化划分为四个层级，它们不是孤立变量，而是一个相互嵌套的动力学闭环：

```
名 (Perception) ───► 资 (Capital Allocation) ───► 实 (Reality Validation)
  ▲                                                      │
  └────────────────── 势 (Evolution Loop) ◄──────────────┘
```

| 层级 | 核心定义 | 核心问题 | 关键观测对象 |
|---|---|---|---|
| **名 / Perception** | 市场对未来的共同解释框架 | 弱信号如何压缩为可交易共识？ | 权威主体、解释密度、标签收敛、龙头绑定 |
| **资 / Capital Allocation** | 认知进入资金与资源配置系统 | 机构是否开始系统性定价与配置？ | 基金持仓、券商深度覆盖、ETF/大市值承接、定增加码 |
| **实 / Reality Validation** | 现实世界发生可核验的物理证据 | 真实产业数据是否正在兑现预期？ | 大客户订单、报表收入/毛利、排产扩产、产业协同 |
| **势 / Evolution Loop** | 名、资、实形成自增强正反馈闭环 | 系统是继续增强、衰退还是再叙事化？ | 预期差弹性、分支生成能力、拥挤度与钝化风险 |

---

### 2.2 S0 到 S7 八阶段状态机

系统将任意一个市场主题抽象为 8 个标准生命周期状态：

```
[S0 潜伏信号] ──► [S1 注意力唤醒] ──► [S2 叙事假说] ──► [S3 标签化]
                                                             │
[S7 主流/衰退/再叙事] ◄── [S6 现实验证] ◄── [S5 定价采纳] ◄── [S4 共识测试]
```

```carousel
| 阶段 | 名称 | 阶段核心特征 | 理论 Alpha 来源 | 失败模式 / 风险点 |
|---|---|---|---|---|
| **S0** | **Latent Signal (潜伏信号)** | 零散早期事实存在（论文、专利、试点），市场未关注 | 研究型 Alpha，适合建立先验观察池 | 过于专业晦涩；缺乏可交易标的映射 |
| **S1** | **Attention (注意力唤醒)** | 市场开始看见信号，新闻与搜索提升，但无统一解释 | 信息发现 Alpha | 孤立新闻，无后续事件；脉冲式噪音 |
| **S2** | **Narrative Hypothesis (假说形成)** | 市场开始追问“这意味着什么”，多种解释版本竞争 | 认知形成 Alpha | 逻辑过于繁复；可交易映射极其微弱 |
| **S3** | **Labeling (标签化)** | 复杂假说压缩为极简交易语言（如“低空经济”、“CPO”） | 主题识别 Alpha | 标签过于抽象；标签冲突导致资金无法合力 |
| **S4** | **Consensus Testing (共识测试)** | 资金介入测试标签，叙事龙头确立，板块有序扩散 | 交易型 Alpha（弹性最大区间） | 有标签无龙头；龙头见顶后板块无承接 |
| **S5** | **Pricing Adoption (定价采纳)** | 机构纳入盈利与估值模型，从小票扩散到中大市值 | 中期机构配置 Alpha | 无法建立测算模型；估值过快透支未来空间 |
| **S6** | **Reality Validation (现实验证)** | 订单、收入、利润、排产等真实财务与产业数据兑现 | 基本面预期差 Alpha | 订单虚弱；兑现速度低于已被打满的市场预期 |
| **S7** | **Mainstream / Mutation (主流或演化)** | S7A 主流化长期配置 / S7B 透支衰退 / S7C 生成新分支 | 生命周期管理 Alpha | 拥挤度极高；利好钝化；缺乏新子叙事延续 |
```

---

### 2.3 状态跃迁的数学动力学

1. **跃迁概率判定**：
   $$\text{Transition Force} = \text{Driving Force} - \text{Friction} + \text{Feedback}$$
   - **Driving Force（驱动力）**：事件权威度 $\times$ 解释密度 $\times$ 标签清晰度 $\times$ 龙头强度 $\times$ 证据密度；
   - **Friction（阻力）**：估值拥挤度 $+$ 标的容量不足 $+$ 现实证据断裂 $+$ 政策不确定性；
   - **Feedback（反馈）**：价格上涨强化叙事、叙事强化吸引资金配置的自反性强度。

2. **势的闭环强度**：
   $$\text{势} = \text{Perception} \to \text{Capital Allocation} \to \text{Reality Validation} \to \text{New Perception} \to \dots$$

---

## 三、快速上手 (Quickstart)

### 3.1 环境要求
- **Node.js** >= 20.0.0
- **npm** >= 9.0.0

### 3.2 三步启动本地研究工作台

```bash
# 1. 克隆代码库并安装依赖
git clone https://github.com/Waloncycler/narrative-lifecycle.git
cd narrative-lifecycle
npm install

# 2. 配置环境（可选：若使用 AI 影子候选提取，可配置 MiniMax 或兼容密钥）
cp .env.example .env

# 3. 启动交互式 Narrative Monitor & Intake 工作台
npm run intake:workbench
```

打开本地浏览器访问：**`http://localhost:4177`**
- 📂 **拖拽录入**：支持 TXT、Markdown、HTML、DOCX、PDF 材料，自动高亮事实引用；
- 🔍 **证据核验卡**：审查生成的证据卡（所属主题、分支、E0-E4 证据强度、影响层级）；
- 📊 **全局大盘监控**：实时查看 27+ 核心主题的阶段分布、跃迁动力与预警雷达。

---

## 四、系统架构与数据流 (Architecture & Data Flow)

### 4.1 Feature-Sliced 模块化设计

系统采用严格的 **Feature-Sliced（特性切片）** 架构，业务逻辑高内聚、层级间低耦合：

```
src/
├── features/               # 独立业务切片（纯领域规则 + IO 隔离）
│   ├── evidence/           # 证据表、导入校验、证据链判定、强度评分规则
│   ├── stages/             # S0-S7 状态分类机、Stage Gate 门槛、阶段 Diff
│   ├── scoring/            # 纯规则打分引擎、定量分析框架
│   ├── narrative/          # 叙事树/图结构、叙事记忆库、主题与分支注册
│   ├── intake/             # 证据录入 Agent、主动学习环、本地 Web 工作台
│   ├── research/           # 自主研究 Agent、Web 检索、直接数据源深度检索
│   ├── worldmonitor/       # 权威数据源编目、Feed 解析、状态变化探测
│   └── reporting/          # Dashboard 状态卡、周度简报、复盘测试、评价体系
├── platform/               # 跨业务共享基础设施（文件存储适配、运行上下文、版本控制）
├── app/                    # 组合根：用例编排、流水线串联
└── cli/                    # 极简 CLI 入口（每个 npm run 命令对应单一入口）
```

> **架构红线**：`domain/` 和 `rules/` 内严禁出现文件系统、网络请求等副作用，纯业务规则 100% 可单测。

---

### 4.2 严格的数据流动管道

```
[43+ 权威情报源 (RSS/API/公告/研报)]
               │
               ▼
   [WorldMonitor 结构化提纯] (去噪音、提取事件时间戳、URL 与事实摘要)
               │
               ▼
   [证据候选提取 (Intake)] (包含原文精确引用、来源层级、E0-E4 强度建议)
               │
               ▼
   [人工审查门槛 (Review Gate)] ──► 拒绝/拆分/修改 ──► 存入主动学习画像
               │ (通过审核)
               ▼
   [正式证据表 (Evidence Table)]
               │
               ▼
   [Stage Gate 状态门槛规则] (依据最低证据标准判定 S0-S7)
               │
               ▼
   [纯规则打分引擎 (Scoring)] ──► [Dashboard 卡 / 演化 Diff / 每周简报]
```

---

## 五、全流程运行指南 (Run The System)

```bash
# ── 1. 证据录入与工作台 ──────────────────────────────────────
npm run intake:workbench              # 启动本地可视化工作台 (127.0.0.1:4177)
npm run evidence:validate             # 校验手动证据草稿格式
npm run evidence:import -- --file <p> # 导入经过验证的证据文件

# ── 2. 核心状态机流水线 ──────────────────────────────────────
npm run pipeline                      # 运行生命周期状态机分类与评分
npm run diff                          # 对比上一期快照，生成状态迁移 Diff
npm run report                        # 生成操作员周度研究简报
npm run weekly                        # 标准运行流：一次性执行 pipeline -> diff -> report

# ── 3. 全球权威情报源同步 ───────────────────────────────────
npm run sources:inventory             # 查看已配置的 43 个权威数据源清单
npm run sources:sync -- --mode sandbox# 沙盒模式同步测试（不污染正式数据）
npm run sources:sync -- --mode live   # 生产模式实时抓取最新动态

# ── 4. 自主研究与线索分诊 ───────────────────────────────────
npm run research:campaign             # 发起全域主题研究巡航任务
npm run research:triage               # 对收集的线索按质量与时效进行分诊
npm run research:retrieve -- --max 6  # 对高优先级线索抓取原文可复核摘录
npm run research:baseline             # 针对 S0 核心主题生成基准核验清单

# ── 5. 影子 AI 与主动学习 ───────────────────────────────────
npm run intake:ai-shadow              # 运行 AI 影子比对（仅作为候选，不自动入库）
npm run intake:ai-evaluate            # 针对 50 篇标准测试集评估 AI 抽取准确度
npm run intake:learning-cycle         # 汇总结算人工修正模式，更新建议画像

# ── 6. 历史回放与质量检验 ───────────────────────────────────
npm run replay                        # 运行基于时间切片的历史叙事回放回测
npm run pilot:init                    # 初始化试点观察账本
npm run pilot:review                  # 生成实盘试点评估报告

# ── 7. 代码规范与单测 ───────────────────────────────────────
npm run typecheck                     # TypeScript 严格类型检查
npm test                              # 运行 Vitest 全量单元测试集 (390+ tests)
```

---

## 六、开源共建与路线图 (Contributing & Roadmap)

我们非常欢迎量化研究员、产业分析师和全栈工程师参与共建！

### 6.1 适合初学者的贡献方向 (Good First Issues)
- 🔌 **数据源适配器**：在 `src/features/worldmonitor/io/` 中接入更多官方机构 RSS / OpenAPI；
- 📝 **产业证据样本**：在 `data/sample_evidence/` 中扩充光伏、半导体、创新药、低空经济等领域的标准证据 YAML；
- 🧠 **行业认知规则包**：在 `src/features/reporting/domain/industry_packs.ts` 中丰富行业专有名词与判定启发式；
- 🌐 **英文国际化**：翻译核心操作指南与理论文档。

### 6.2 发展路线图 (Roadmap)

- [x] **v0.13**：完成 43 个全球权威源网格、S0-S7 状态机、Feature-Sliced 模块化重构与开源基线；
- [ ] **v0.14**：支持基于 SQLite / PostgreSQL 的持久化仓储层（替代本地文件持久化）；
- [ ] **v0.15**：开发独立的多人协作 Web 研报看板（团队共享叙事池与批注）；
- [ ] **v0.16**：接入彭博/万得/Refinitiv 机构级数据接口插件；
- [ ] **v0.17**：开放标准 Python SDK，方便量化团队在 Notebook 中直接调用状态迁移因子。

详见：🤝 [CONTRIBUTING.md](CONTRIBUTING.md) · 🛡️ [SECURITY.md](SECURITY.md)

---

## 七、核心文档索引 (Documentation Index)

| 领域 | 推荐必读文档 | 说明 |
|---|---|---|
| 📖 **理论著作** | [《市场叙事生命周期理论 · 第一版》(Markdown)](docs/theory/市场叙事生命周期理论_第一版.md) / [PDF](docs/theory/市场叙事生命周期理论_第一版.pdf) | **理论体系完整版（12章全本）** |
| 🏗️ **核心规则** | [01 · 名、资、实、势理论体系](docs/01_theory_name_capital_reality_momentum.md)<br>[02 · S0 到 S7 状态定义](docs/02_lifecycle_states_S0_S7.md)<br>[03 · 最低证据标准](docs/03_minimum_evidence_standards.md)<br>[06 · 定量打分体系 (v0.2)](docs/06_scoring_system_v0_2.md) | 状态机判定、证据准入与打分底层逻辑 |
| 🛡️ **质量治理** | [04 · 误分类纠错规则](docs/04_misclassification_correction_rules.md)<br>[08 · 失败案例库与反思](docs/08_failure_case_library.md)<br>[26 · 治理型主动学习框架](docs/26_governed_active_learning.md) | 防范概念炒作、假叙事与过拟合的防护栏 |
| 🌐 **数据集成** | [07 · 数据源与证据表设计](docs/07_data_sources_and_evidence_table.md)<br>[27 · 全球权威数据源集成地图](docs/27_worldmonitor_data_sources_integration_map.md) | 涵盖监管、学术、媒体、财报的 43+ 数据源 |
| 💻 **操作手册** | [EVIDENCE_GUIDE (证据编写手册)](docs/EVIDENCE_GUIDE.md)<br>[OPERATOR_GUIDE (操作员指南)](docs/OPERATOR_GUIDE.md)<br>[REPLAY_GUIDE (历史回放指南)](docs/REPLAY_GUIDE.md)<br>[TROUBLESHOOTING (故障排查)](docs/TROUBLESHOOTING.md) | 零代码/低代码实操与维护手册 |

---

## 八、金标准真实案例 (Golden Cases)

代码库中内置了 3 个完整的经过严格回测与标注的典型叙事全生命周期样本：

- 🧬 [`data/golden_cases/bci.yaml`](data/golden_cases/bci.yaml) — **脑机接口 (BCI)**：从论文专利 ($S_0$)、临床试验 ($S_1/S_2$) 到资本扩散 ($S_4$) 的演化链条；
- 🤖 [`data/golden_cases/humanoid_robotics.yaml`](data/golden_cases/humanoid_robotics.yaml) — **人形机器人 (Humanoid Robotics)**：从概念发布到产业链零部件扩散的共识测试；
- 💊 [`data/golden_cases/innovative_drug_license_out.yaml`](data/golden_cases/innovative_drug_license_out.yaml) — **创新药出海 License-out**：典型的现实验证与商业化兑现案例。

---

## 许可证 (License)

本项目采用 [MIT License](LICENSE) 开源。

```
Copyright (c) 2026 Narrative Lifecycle Contributors
```

<div align="center">
<b>致敬所有相信“证据先于叙事”的严肃研究者。</b><br>
<sub>Dedicated to researchers who believe evidence must precede narrative.</sub>
</div>
