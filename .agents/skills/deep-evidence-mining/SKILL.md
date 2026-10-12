---
name: deep-evidence-mining
description: 规范针对监管批文、法定信息披露、学术顶刊、临床试验及政府采购等高优先级情报线索的深度探针挖掘标准，提取具备精确字符偏移溯源与法理依据的高置信度硬核证据。
---

# 深度证据探针挖掘专家 (Deep Evidence Mining Probe Skill)

本 Skill 规范了对全网抓取的高价值情报线索（如中国政府采购网 CCGP、国家药监局 CDE 临床登记平台、巨潮资讯法定披露、SEC EDGAR、TrendForce/百川现货遥测、ClinicalTrials.gov、PubMed、arXiv 及远端 PDF 官方附件）执行**深度下钻探针挖掘（Deep-Dive Research Probes）**的标准流程。

---

## 1. 支持的 4 大专用深度探针类型 (Specialized Deep Probes)

1. **`PROBE_CCGP_TENDER`（政府采购与公共资源招投标探针）**：
   - 提取字段：招标项目名称、采购人、中标供应商、中标金额（精确到万元）、标的规格、交付周期与验收标准；
2. **`PROBE_CTR_CLINICAL`（国家药监局 CDE / CTR 临床试验探针）**：
   - 提取字段：CTR 注册号、药物/器械通用名、申办方、适应症、临床试验分期（I/II/III 期）、入组状态与主要临床终点；
3. **`PROBE_COMMODITY_SPOT`（微观产业链现货价格与开工率遥测探针）**：
   - 提取字段：关键原材料/元器件现货出厂价、计价单位、周环比涨跌幅、全行业开工率百分比与库存周转天数；
4. **`PROBE_REMOTE_PDF_DISASSEMBLY`（远端 PDF 研报与法定公告附件解构探针）**：
   - 多引擎流式反编译解析官方 PDF 附件，提取包含核心成本图表、折旧分摊底表、临床有效率表格及合同明细的深层正文。

---

## 2. 探针标准输入结构 (Standard Input Payload)

每次调用深度挖掘探针时，必须传入以下结构化参数：

* `lead_id`: 情报线索唯一标识符；
* `source_url`: 目标文件、网页或远端 PDF 的完整真实链接；
* `source_class`: 权威等级（`official` 官方法定 | `company_primary` 上市公司一手 | `academic` 权威学术 | `statutory_filing` 法定披露 | `procurement_tender` 政府采购）；
* `topic_id`: 归属题材 ID（未归类时为 `null`）；
* `branch_id`: 细分分支 ID（母题材时为 `null`）；
* `raw_content`: 抓取到的 HTML、JSON、XML、PDF 二进制/纯文本内容。

---

## 3. 探针执行与提纯规范 (Execution Protocol)

1. **噪音剔除、多引擎 PDF 提纯与结构化解析**：
   - 彻底剔除导航栏、页脚、Cookie 弹窗、免责声明及无关脚本；
   - 对 PDF 材料（本地或远端下载），采用多引擎反编译，保留段落与表格排版边界完整性；
   - 对结构化接口（如 CDE 临床公示、CCGP 招投标表格、SEC 10-K/8-K 表格），提取章节级标题与精确数值字段。
2. **字符级精准溯源与语句对齐 (Sentence-Level Provenance)**：
   - 采用标准语句边界标点（`。`、`！`、`？`、`；`、`.`、`!`、`?`）切分原子句子；
   - 精确计算原始文档中的 0 起始字符偏移区间（`quote_start_offset`, `quote_end_offset`），确保每一条证据都有据可查、一字不差。
3. **证据等级与影响层级严密映射**：
   - `official` / `statutory_filing` / `procurement_tender` (CCGP, Gov.cn, Cninfo): 证据等级上限 `E3`~`E4`，主要影响层级 `capital`（资本层） / `reality`（现实层） / `friction`（摩擦层）；
   - `clinical_trial` (Chinadrugtrials CTR, CDE, ClinicalTrials.gov): 证据等级上限 `E3`~`E4`，主要影响层级 `reality` / `friction`；
   - `commodity_spot` (TrendForce, 百川盈孚): 证据等级上限 `E2`，主要影响层级 `pricing`（定价层） / `reality`；
   - `academic` / `scientific`: 证据等级上限 `E2`~`E3`，主要影响层级 `reality` / `name`。

---

## 4. 标准输出 JSON 格式规范 (Strict Output JSON Schema)

探针必须输出符合 `schemas/research_source_retrieval_report.schema.json` 规范的 JSON 对象：

```json
{
  "lead_id": "lead_ccgp_20260822_001",
  "evidence_eligibility": "candidate",
  "next_action": "prepare_intake",
  "excerpts": [
    {
      "quote": "中标供应商：XXX智能装备股份有限公司，中标金额：85,000,000元人民币，交付期：2026年12月前完成200台人形机器人量产下线并进厂实训。",
      "quote_start_offset": 1240,
      "quote_end_offset": 1326,
      "location_label": "中标结果公告第三项：中标标的与金额",
      "extracted_entities": {
        "amount_rmb": "8500万元",
        "units": "200台",
        "delivery_date": "2026-12"
      }
    }
  ]
}
```
