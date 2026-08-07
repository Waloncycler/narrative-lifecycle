---
name: intake-llm-analysis
description: Standardizes LLM analysis prompts, input context, and strict JSON output schemas for evidence candidate extraction, AI Shadow validation, and evidence chain proposals.
---

# Intake LLM Analysis & Validation Skill Specification

This skill standardizes all LLM interactions within the Narrative Lifecycle Intake Agent pipeline, enforcing strict input/output contracts and system schema alignment.

## 1. System Guardrails & Prohibitions

1. **No Trading Advice (无交易建议防线)**:
   - Prohibit any actionable financial advice, buy/sell targets, price forecasts, or trading recommendations.
   - Enforce explicit research-only disclaimer formatting: `"This analysis is for research purposes only and does not constitute trading or investment advice."`
2. **Provenance & Source Verifiability (严格引用溯源)**:
   - Every extracted candidate MUST include an exact string quotation (`original_quote`) copied verbatim from the source text.
   - Must specify valid `quote_start_offset` and `quote_end_offset`.
3. **Parent vs. Branch Isolation (母主题与分支硬隔离)**:
   - Branch evidence (`scope: "branch"`) MUST specify `branch_id` and MUST NOT elevate a parent topic stage directly.
   - Stage effect MUST be `split_branch` or `observation` for branch-scoped findings.

## 2. Standard Input Contract

Every LLM request MUST provide:
- `raw_document`: Text, source name, ingested timestamp, and document ID.
- `registry_context`: Active topics, branch list, aliases, and memory topics.
- `current_stage_snapshot`: Topic ID, current stage S0-S7, and why-not-higher barriers.
- `target_scope`: `parent` | `branch` | `auto`.

## 3. Standard Output JSON Schema

The LLM MUST return a valid JSON object matching `schemas/intake_agent_review_bundle.schema.json` with:

```json
{
  "candidates": [
    {
      "candidate_id": "string",
      "source_candidate_id": "string",
      "suggested_evidence": {
        "evidence_id": "string",
        "topic_id": "string",
        "branch_id": "string | null",
        "scope": "parent | branch",
        "event_date": "YYYY-MM-DD",
        "available_at": "ISO-8601",
        "event_title": "string",
        "event_summary": "string",
        "source_name": "string",
        "source_url": "string",
        "evidence_strength": "E0 | E1 | E2 | E3 | E4",
        "affected_layer": ["name | capital | pricing | reality | momentum | friction | data_confidence"],
        "polarity": "positive | negative | mixed",
        "stage_effect": "upgrade | downgrade | split_branch | observation",
        "interpretation": "string",
        "limitation": "string"
      },
      "validation_status": "passed | failed",
      "fallback_used": false
    }
  ]
}
```
