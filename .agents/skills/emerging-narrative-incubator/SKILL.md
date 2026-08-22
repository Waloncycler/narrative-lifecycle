---
name: emerging-narrative-incubator
description: 规范新兴产业与前沿科技概念的自动发现、真伪语义辨析（严格甄别真实物理范式转移与概念营销换皮）、多源交叉验证碰撞以及在S0生命周期阶段的自动建档与大盘雷达纳管。
---

# 新题材涌现与概念孵化专家 (Emerging Narrative Incubator Skill)

本 Skill 规范了对全网实时监测流中新出现的技术名词、前沿工业概念进行**自动捕捉**、**真假辨析（营销换皮 vs 真实物理范式转移）**、**3 信源交叉验证**并在 SQLite 数据库中自动完成 **S0 建档上雷达**的标准流程。

---

## 1. 核心数据输入通道 (Multi-Source Input Streams)

本 Skill 从以下 **6 大权威监控网** 中持续扫描未归类的新实体与新名词：
1. **中国政府网 / 国家发改委 / 工信部十五五重大课题与前瞻规划**（国家级战略发端）；
2. **中国政府采购网 (CCGP) 与公共资源交易中心**（首台套/首批次工程招标与验证需求）；
3. **国家药监局 CDE 临床试验登记平台 (Chinadrugtrials CTR)**（全球首次申报新靶点/新结构分子）；
4. **东方财富研报中心新兴前沿行业研报 & 远端 PDF 附件**（券商分析师首次覆盖的新赛道）；
5. **全球关键领袖发言与前沿论文 (VIP Speakers & Nature/Science/arXiv)**（黄仁勋、马斯克、Altman 等领袖首次提出的概念，如 Physical AI、Hollow-Core Fiber）；
6. **巨潮资讯与海外资本披露**（创新企业 Pre-IPO 募投中试线项目）。

---

## 2. 孵化与审查三大标准步骤 (Standard 3-Step Incubator Protocol)

### 步骤一：新名词捕捉与实体提取 (Extraction)
- 扫描实时抓取事实，识别未在现有 44 个题材字典中注册的全新技术名词或产业实体；
- 提取其母行业领域（Domain）与技术特征描述。

### 步骤二：真伪辨析与营销换皮审查 (Disambiguation)
必须严格执行二元审查，一针见血判定其是否为营销炒作：
- ❌ **判定为【营销换皮 (Marketing Rebranding)】的特征**：
  - 底层物理机理/化学配方未发生实质改变，仅为商业包装噱头（如“量子自旋电池”实际为普通掺杂锂电）；
  - **处置原则**：坚决拒绝独立建档，强制归并至既有父题材或分支，并在系统备注中标记为营销噱头。
- ✅ **判定为【真实范式转移 (True Paradigm Shift)】的特征**：
  - 突破传统材料或物理极限（如：玻璃基板替代有机基板解决翘曲问题、空芯光纤突破石英光速极限）；
  - 具备独立的专用制造工艺、全新材料体系或全新商业生态；
  - **处置原则**：准予进入多源验证流程。

### 步骤三：多源验证与 S0 孵化档案建档 (Multi-Source Clustering & S0 Ingestion)
- **准入门槛**：必须在 **>= 3 个独立权威信源**（如：领袖公开宣布 ➕ 券商深度报告 ➕ 权威期刊/国家部委规划）中得到交叉印证；
- **自动落库**：生成唯一的 `provisional_topic_id`，赋予初始阶段 `S0`，自动写入 SQLite `topics` 表，正式登上叙事大盘雷达！

---

## 3. 标准 JSON 孵化档案输出格式 (S0 Dossier Schema)

```json
{
  "emerging_topic": {
    "provisional_topic_id": "provisional_[snake_case_name]",
    "topic_name_zh": "中文标准规范名",
    "market_name_en": "Standard English Name",
    "parent_domain": "所属一级母领域",
    "disambiguation_result": {
      "is_rebranding": false,
      "rebranding_target": null,
      "novelty_justification": "底层物理机理/材料体系突破的具体差异化说明"
    },
    "independent_source_count": 3,
    "initial_stage": "S0",
    "incubation_thesis": "为什么该赛道代表了未来 3-5 年的核心演化方向",
    "core_bottlenecks": [
      "首要工程良率瓶颈",
      "关键设备与材料瓶颈"
    ]
  }
}
```
