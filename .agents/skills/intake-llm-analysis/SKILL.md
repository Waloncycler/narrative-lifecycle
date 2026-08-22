---
name: intake-llm-analysis
description: 规范大模型在证据智能提取、AI影子审计验证及证据链提纯流程中的提示词规范、上下文输入契约与严格JSON输出格式，确保零幻觉与实体层级硬隔离。
---

# 证据智能提取与大模型审计验证专家 (Intake LLM Analysis & Validation Skill)

本 Skill 规范了 Narrative Lifecycle 证据提取代理流水线（Intake Agent Pipeline）中所有与大语言模型（LLM）的交互标准，强制执行严密的系统输入输出契约，确保数据入库符合全维 schema 定义与法理证据标准。

---

## 1. 系统核心安全防线与质量红线 (System Guardrails)

1. **绝对禁止交易与投资建议 (No Trading Advice)**：
   - 严禁输出任何形式的股票买卖建议、目标价位、仓位配置或投资操作指令；
   - 强制附带严谨的免责声明：`“本分析仅供机构产业研究与叙事生命周期客观评估使用，不构成任何投资或交易建议。”`
2. **字符级原文精准引用与防幻觉 (Provenance & Verifiability)**：
   - 每一个提炼出的候选证据必须包含从原始文本中逐字复制的原文片段（`original_quote`）；
   - 必须提供有效的起始与结束字符偏移量（`quote_start_offset`, `quote_end_offset`），严禁凭空编造数值或参数。
3. **母题材与细分分支硬隔离 (Parent vs. Branch Isolation)**：
   - 归属于细分分支的证据（`scope: "branch"`）必须显式指定 `branch_id`，严禁直接推动母题材全局阶段的升级；
   - 分支证据的阶段效应必须标记为 `split_branch`（分支裂变）或 `observation`（分支观察）。

---

## 2. 标准输入契约 (Standard Input Contract)

每次向大模型发起提取请求时，必须组装并传入以下上下文：

- `raw_document`: 原始文本内容、数据源名称、抓取时间戳与文档全局 ID；
- `registry_context`: 当前系统中已注册的 44+ 题材清单、已知分支列表、行业别名与记忆库；
- `current_stage_snapshot`: 目标题材当前所处的生命周期阶段（S0~S7）及其 Why-Not-Higher 门槛阻力矩阵；
- `target_scope`: 判定作用域（`parent` 母题材 | `branch` 细分分支 | `auto` 自动识别）。

---

## 3. 标准输出 JSON 格式规范 (Strict Output JSON Schema)

大模型必须返回完全满足 `schemas/intake_agent_review_bundle.schema.json` 定义的结构化 JSON 对象：

```json
{
  "candidates": [
    {
      "candidate_id": "cand_20260822_001",
      "source_candidate_id": "src_cand_001",
      "suggested_evidence": {
        "evidence_id": "ev_humanoid_robotics_20260822_tender",
        "topic_id": "humanoid_robotics",
        "branch_id": null,
        "scope": "parent",
        "event_date": "2026-08-22",
        "available_at": "2026-08-22T08:00:00.000Z",
        "event_title": "中国政府采购网公示：某智造领军企业中标 8500 万元人形机器人示范工程项目",
        "event_summary": "中标金额达 8500 万元，年内交付 200 台具备 22 个自由度灵巧手的人形机器人，用于高端装配线实训。",
        "source_name": "中国政府采购网 (CCGP)",
        "source_url": "http://www.ccgp.gov.cn/cggg/dfgg/zbgg/202608/t20260822_12345.htm",
        "evidence_strength": "E3",
        "affected_layer": ["capital", "reality"],
        "polarity": "positive",
        "stage_effect": "observation",
        "interpretation": "[政府采购大单] 经 CCGP 法定招投标公示验证，单笔订单突破千万级，证实商业化交付与真实客户付费已跨越 S4 验证点。",
        "limitation": "首批进厂实训后的批量复购与良品率仍需后续经审计财报印证"
      },
      "validation_status": "passed",
      "fallback_used": false
    }
  ]
}
```
