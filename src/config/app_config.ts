// Auto-generated configuration

export const autonomousResearchPolicy = {
  "policy_id": "v0.10-review-first-publication",
  "enabled": true,
  "auto_register_provisional_topics": true,
  "auto_register_watch_branches": true,
  "auto_promote_provisional_topics": true,
  "auto_activate_watch_branches": true,
  "minimum_independent_sources_for_topic_activation": 2,
  "minimum_independent_sources_for_branch_activation": 2,
  "require_parent_evidence_for_topic_activation": true,
  "auto_publish_evidence": true,
  "auto_recompute_stage": true,
  "require_model_validation": true,
  "allow_rule_verified_publication": true,
  "minimum_evidence_strength": "E1",
  "minimum_confidence": "medium",
  "permitted_source_types": ["official", "filing", "research", "academic", "company"],
  "allow_news_auto_publish": false,
  "require_source_url": true,
  "require_provenance": true,
  "hold_parent_branch_risk": true,
  "hold_conflicting_evidence": true,
  "hold_stage_jump_above": "S4"
}
;

export const researchAgentSchedulerConfig = {
  "artifact_type": "research_agent_scheduler_config",
  "schema_version": "1.0.0",
  "enabled": true,
  "timezone": "Asia/Shanghai",
  "daily_cron": "0 6 * * *",
  "daily_max_operations": 40,
  "quick_interval_hours": 6,
  "quick_max_operations": 12,
  "quick_enabled": true,
  "deep_enabled": true,
  "deep_cron": "0 7 * * *",
  "deep_max_rounds": 20,
  "deep_queries_per_round": 50,
  "purge": {
    "stale_candidate_max_age_days": 30,
    "queue_high_priority_max_age_days": 14,
    "queue_medium_priority_max_age_days": 21,
    "queue_low_priority_max_age_days": 30,
    "evolution_history_max_entries": 30
  },
  "guardrail_check": {
    "no_auto_import": false,
    "no_auto_stage_change": false,
    "no_auto_topic_activation": false,
    "no_auto_rule_mutation": false
  }
}
;
