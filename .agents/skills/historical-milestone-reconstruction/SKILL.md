---
name: historical-milestone-reconstruction
description: 规范针对任何工业叙事进行过去3-5年关键历史里程碑锚点事件的定向深度回溯与知识图谱重构，覆盖巨潮/SEC法定披露、国务院/发改委红头档案、FDA/NMPA临床批文及标杆产业资本交易。
---

# 历史里程碑证据链回溯与厚度构建专家 (Historical Milestone Reconstruction Skill)

本 Skill 规范了对任何新建立或底座单薄的工业叙事题材，进行**过去 3-5 年关键历史里程碑定向回溯**的标准流程。坚决杜绝“无目的全网乱爬陈年旧闻”导致本地数据库膨胀，确保每一条回溯的历史证据都具备极高的时间厚度和法律/法定依据。

---

## 1. 五大权威历史回溯锚点探针 (5 Standard Anchor Probes)

回溯时严禁抓取自媒体评论，必须严格对准以下 **5 大权威官方与法定源头**：
1. **监管资质与官方批文探针**：
   - 检索：中国政府网、国家发改委批复、国家药监局 CDE 临床批件 (IND)、民航局 CAAC 适航审定、美国 FDA IDE/BLA；
2. **首笔重大商业定点与合同探针**：
   - 检索：巨潮资讯网 A 股法定公告、SEC 8-K 披露（首笔 1000 万+ 真实订单、全球巨头供应链定点函）；
3. **国家级顶层战略规划探针**：
   - 检索：国务院发文、工信部专项攻关指南、揭榜挂帅名单、首台套装备认定；
4. **底层物理参数与学术拐点探针**：
   - 检索：Nature / Science 封面突破、顶级学术期刊实测数据（如光速延迟降低33%、钙钛矿效率突破30%）；
5. **标杆产业资本中试线注资探针**：
   - 检索：顶级产业基金领投 A/B 轮、中试基地（Pilot Line）开工与重大设备进场采购。

---

## 2. 回溯执行与质量控制原则 (Execution & Quality Standards)

- **数量控制**：每个题材精准回溯 **10 ~ 15 条** 最关键的历史拐点，严禁堆砌无意义的平庸新闻；
- **时间跨度**：覆盖过去 **3 ~ 5 年** 完整的技术演化脉络（概念 ➔ 实验室 ➔ 样机 ➔ 政策 ➔ 商业订单）；
- **落库标准**：直接生成符合 SQLite `evidence` 表字段的结构化对象（包含精确 `event_date`、`evidence_strength: E2/E3`、`affected_layer_json`、`source_url`）。

---

## 3. 标准历史里程碑数据格式 (Audited Milestone Schema)

```json
{
  "reconstructed_milestones": [
    {
      "evidence_id": "ev_[topic_id]_[YYYYMMDD]_[anchor_type]",
      "topic_id": "target_topic_id",
      "branch_id": null,
      "event_date": "YYYY-MM-DD",
      "event_title": "里程碑标准中文标题（如：FDA 批准首次人体临床试验）",
      "event_summary": "具体发生的核心技术或商业事实摘要",
      "event_type": "REGULATORY_APPROVAL | COMMERCIAL_CONTRACT | TECH_INFLECTION | CAPITAL_TRANSACTION",
      "source_name": "权威信源出处（如：NMPA Official / Cninfo Statutory Filing）",
      "source_url": "可追溯的官方链接或公告编号",
      "source_type": "official | regulatory_filing | academic",
      "evidence_strength": "E3",
      "stage_effect": "upgrade",
      "parent_or_branch": "parent",
      "interpretation": "该历史事件在题材演化周期中起到的决定性定轴作用",
      "limitation": "当时的局限性或历史背景约束",
      "positive_or_negative": "positive",
      "confidence": 95,
      "affected_layer": ["reality", "capital"]
    }
  ]
}
```
