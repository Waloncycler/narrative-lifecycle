# 16 Performance and Cost Optimization

## Principle

Do not reprocess everything every time. Use incremental updates.

## Incremental Update Fields

- event_hash
- evidence_hash
- last_processed_at
- dirty_flag
- affected_topic_ids
- affected_branch_ids

## LLM Cost Control

Use tiered calls:

| Task | Preferred Method |
|---|---|
| duplicate detection | rule/hash first |
| date/source extraction | rules or small model |
| evidence classification | small/medium model |
| stage reasoning | stronger model with rules |
| report generation | stronger model |

## Cache

Cache:

- raw_text_summary_cache
- evidence_extraction_cache
- classification_cache
- reasoning_cache
- report_cache

## Rule Before LLM

Filter irrelevant or duplicate events before calling LLM.
