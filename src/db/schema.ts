import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// ===========================================================================
// 1. 核心业务与状态机持久化表 (Core Production & Narrative State Tables)
// ===========================================================================

/**
 * 题材赛道注册表 (Canonical Topics Registry)
 */
export const topics = sqliteTable('topics', {
  topic_id: text('topic_id').primaryKey(),
  topic_name: text('topic_name').notNull(),
  market_name_en: text('market_name_en'),
  status: text('status').notNull(),
  current_stage: text('current_stage').notNull(),
  domain: text('domain').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  aliases_json: text('aliases_json'),
});

/**
 * 细分分支表 (Topic Sub-Branches)
 */
export const branches = sqliteTable('branches', {
  branch_id: text('branch_id').primaryKey(),
  topic_id: text('topic_id').notNull().references(() => topics.topic_id),
  market_name_zh: text('market_name_zh').notNull(),
  market_name_en: text('market_name_en'),
  naming_status: text('naming_status').notNull(),
  created_at: text('created_at').notNull(),
});

/**
 * 硬核证据资产主表 (Primary Quantitative Evidence Table)
 * 系统核心单一真实源 (Single Source of Truth)，支持字符偏移溯源与法理判定。
 */
export const evidence = sqliteTable('evidence', {
  evidence_id: text('evidence_id').primaryKey(),
  topic_id: text('topic_id').notNull().references(() => topics.topic_id),
  branch_id: text('branch_id'),
  event_date: text('event_date').notNull(),
  available_at: text('available_at').notNull(),
  event_title: text('event_title').notNull(),
  event_summary: text('event_summary'),
  event_type: text('event_type').notNull(),
  source_name: text('source_name').notNull(),
  source_url: text('source_url'),
  source_type: text('source_type'),
  evidence_strength: text('evidence_strength').notNull(),
  stage_effect: text('stage_effect').notNull(),
  parent_or_branch: text('parent_or_branch'),
  interpretation: text('interpretation'),
  limitation: text('limitation'),
  positive_or_negative: text('positive_or_negative'),
  confidence: integer('confidence'),
  affected_layer_json: text('affected_layer_json').notNull(),
}, (table) => ({
  topicIdx: index('idx_evidence_topic').on(table.topic_id),
  branchIdx: index('idx_evidence_branch').on(table.branch_id),
}));

/**
 * 原始材料全文库 (Raw Documents Storage)
 */
export const rawDocuments = sqliteTable('raw_documents', {
  raw_document_id: text('raw_document_id').primaryKey(),
  source_name: text('source_name').notNull(),
  source_kind: text('source_kind').notNull(),
  ingested_at: text('ingested_at').notNull(),
  text: text('text').notNull(),
  character_count: integer('character_count').notNull(),
});

/**
 * 材料摄取会话与候选切片 (Intake Sessions)
 */
export const intakeSessions = sqliteTable('intake_sessions', {
  session_id: text('session_id').primaryKey(),
  generated_at: text('generated_at').notNull(),
  raw_document_id: text('raw_document_id').references(() => rawDocuments.raw_document_id),
  chunks_json: text('chunks_json'),
  provenance_records_json: text('provenance_records_json'),
  candidates_json: text('candidates_json'),
  ai_shadow_candidates_json: text('ai_shadow_candidates_json'),
  candidate_comparisons_json: text('candidate_comparisons_json'),
  review_template_json: text('review_template_json'),
});

/**
 * 系统运行记录表 (System Runs Ledger)
 */
export const systemRuns = sqliteTable('system_runs', {
  run_id: text('run_id').primaryKey(),
  rule_version: text('rule_version').notNull(),
  artifact_version: text('artifact_version').notNull(),
  started_at: text('started_at').notNull(),
  completed_at: text('completed_at'),
  status: text('status').notNull(),
  guardrail_status: text('guardrail_status'),
  manifest_json: text('manifest_json').notNull(),
});

/**
 * 全局生命周期阶段快照 (Stage Snapshots)
 */
export const stageSnapshots = sqliteTable('stage_snapshots', {
  snapshot_id: text('snapshot_id').primaryKey(),
  run_id: text('run_id').notNull(),
  generated_at: text('generated_at').notNull(),
  snapshot_json: text('snapshot_json').notNull(),
});

/**
 * 生命周期阶段差异表 (Stage Diffs)
 */
export const stageDiffs = sqliteTable('stage_diffs', {
  diff_id: text('diff_id').primaryKey(),
  run_id: text('run_id').notNull(),
  generated_at: text('generated_at').notNull(),
  diff_json: text('diff_json').notNull(),
});

/**
 * 机构级每周/每日战报存储 (Weekly Briefs / Reports)
 */
export const weeklyBriefs = sqliteTable('weekly_briefs', {
  report_id: text('report_id').primaryKey(),
  run_id: text('run_id').notNull(),
  generated_at: text('generated_at').notNull(),
  report_json: text('report_json').notNull(),
});

/**
 * 操作员审计复核日志 (Operator Reviews)
 */
export const operatorReviews = sqliteTable('operator_reviews', {
  review_id: text('review_id').primaryKey(),
  generated_at: text('generated_at').notNull(),
  review_json: text('review_json').notNull(),
});

/**
 * 通用快照与结构化资产表 (Generic Artifacts Store)
 */
export const genericArtifacts = sqliteTable('generic_artifacts', {
  artifact_id: text('artifact_id').primaryKey(),
  artifact_type: text('artifact_type').notNull(),
  updated_at: text('updated_at').notNull(),
  content_json: text('content_json').notNull(),
  content_md: text('content_md'),
});

/**
 * 单次 HTTP 抓取审计跟踪表 (Collection Attempts Trail)
 */
export const collectionAttempts = sqliteTable('collection_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source_id: text('source_id').notNull(),
  operation_id: text('operation_id'),
  started_at: text('started_at').notNull(),
  ended_at: text('ended_at'),
  duration_sec: text('duration_sec'),
  status: text('status').notNull(),
  http_status_code: integer('http_status_code'),
  snapshots_new: integer('snapshots_new').notNull().default(0),
  snapshots_dup: integer('snapshots_dup').notNull().default(0),
  cursor_before: text('cursor_before'),
  cursor_after: text('cursor_after'),
  error_msg: text('error_msg'),
  is_failure: integer('is_failure').notNull().default(0),
}, (table) => ({
  sourceStartedIdx: index('idx_ca_source_started').on(table.source_id, table.started_at),
}));

/**
 * 原始 HTTP 响应快照库 (Raw Snapshots for Traceability)
 */
export const rawSnapshots = sqliteTable('raw_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source_id: text('source_id').notNull(),
  external_id: text('external_id').notNull(),
  fetched_at: text('fetched_at').notNull(),
  source_published_at: text('source_published_at'),
  raw_url: text('raw_url'),
  content_type: text('content_type').notNull().default('json'),
  raw_body: text('raw_body'),
  content_hash: text('content_hash'),
  normalized_evidence_id: text('normalized_evidence_id'),
  created_at: text('created_at').notNull(),
});

/**
 * 规范化事件聚合表 (Canonical Events Deduplication)
 */
export const canonicalEvents = sqliteTable('canonical_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  event_key: text('event_key').notNull().unique(),
  title: text('title').notNull(),
  normalized_title: text('normalized_title').notNull(),
  canonical_url: text('canonical_url'),
  first_observed_at: text('first_observed_at').notNull(),
  last_observed_at: text('last_observed_at').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

/**
 * 证据与规范事件关联表 (Evidence-to-Canonical-Event Mapping)
 */
export const evidenceEventMembership = sqliteTable('evidence_event_membership', {
  evidence_id: text('evidence_id').primaryKey(),
  event_id: integer('event_id').notNull(),
  match_method: text('match_method').notNull(),
  similarity: text('similarity').notNull().default('1.0'),
  joined_at: text('joined_at').notNull(),
}, (table) => ({
  eventIdx: index('idx_eem_event').on(table.event_id),
}));

// ===========================================================================
// 2. 实验性与未来扩展表 (Experimental & Future Extension Tables)
// ===========================================================================

/**
 * @experimental 假说与可证伪预测账本 (Falsifiable Prediction Ledger)
 */
export const decisionLedger = sqliteTable('decision_ledger', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ledger_key: text('ledger_key').notNull().unique(),
  decision_kind: text('decision_kind').notNull(),
  topic_id: text('topic_id'),
  branch_id: text('branch_id'),
  evidence_ids_json: text('evidence_ids_json').notNull().default('[]'),
  title: text('title').notNull(),
  thesis: text('thesis').notNull(),
  predicted_observation: text('predicted_observation').notNull(),
  affected_layers: text('affected_layers'),
  falsifier: text('falsifier').notNull(),
  horizon_at: text('horizon_at').notNull(),
  status: text('status').notNull().default('open'),
  result_note: text('result_note'),
  system_prediction: text('system_prediction'),
  user_prediction: text('user_prediction'),
  user_reason: text('user_reason'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  resolved_at: text('resolved_at'),
}, (table) => ({
  statusIdx: index('idx_dl_status').on(table.status),
  topicIdx: index('idx_dl_topic').on(table.topic_id),
}));

/**
 * @experimental 事件共振滑动窗口观测表 (Sliding Window Event Observations)
 */
export const eventObservations = sqliteTable('event_observations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  event_id: integer('event_id').notNull(),
  observed_at: text('observed_at').notNull(),
  window_hours: integer('window_hours').notNull(),
  mention_count: integer('mention_count').notNull().default(0),
  distinct_source_count: integer('distinct_source_count').notNull().default(0),
  latest_member_seen_at: text('latest_member_seen_at'),
});

/**
 * @experimental 用户质量反馈流 (User Feedback Events)
 */
export const feedbackEvents = sqliteTable('feedback_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evidence_id: text('evidence_id').notNull(),
  feedback_type: text('feedback_type').notNull(),
  note: text('note'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  evidenceIdx: index('idx_fe_evidence').on(table.evidence_id),
}));

/**
 * @experimental 私有投研笔记与知识边 (Private Knowledge Entries)
 */
export const knowledgeEntries = sqliteTable('knowledge_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind').notNull(),
  content: text('content').notNull(),
  original_filename: text('original_filename'),
  media_type: text('media_type'),
  influence_enabled: integer('influence_enabled').notNull().default(1),
  created_at: text('created_at').notNull(),
});

/**
 * @experimental 历史失败案例记忆表 (Historical Narrative Failure Memories)
 */
export const narrativeMemories = sqliteTable('narrative_memories', {
  topic_id: text('topic_id').primaryKey().references(() => topics.topic_id),
  first_seen_date: text('first_seen_date'),
  last_active_date: text('last_active_date'),
  historical_stage_path_json: text('historical_stage_path_json'),
  previous_peak_stage: text('previous_peak_stage'),
  previous_failed_transition: text('previous_failed_transition'),
  previous_failure_reason: text('previous_failure_reason'),
  previous_missing_evidence_json: text('previous_missing_evidence_json'),
  previous_friction_points_json: text('previous_friction_points_json'),
  previous_branch_structure_json: text('previous_branch_structure_json'),
  is_failure_case: integer('is_failure_case', { mode: 'boolean' }),
  memory_confidence: integer('memory_confidence'),
});

/**
 * @experimental 数据源治理与状态轮询表 (Source Governance & Scheduling)
 */
export const sourceGovernance = sqliteTable('source_governance', {
  source_id: text('source_id').primaryKey(),
  source_name: text('source_name').notNull(),
  adapter_type: text('adapter_type').notNull(),
  role: text('role').notNull().default('signal'),
  url: text('url'),
  priority: text('priority').notNull().default('P1'),
  poll_interval_sec: integer('poll_interval_sec').notNull().default(3600),
  license_status: text('license_status').notNull().default('unknown'),
  license_note: text('license_note'),
  enabled: integer('enabled').notNull().default(1),
  etag: text('etag'),
  last_modified: text('last_modified'),
  cursor: text('cursor'),
  pending_retry_after_sec: integer('pending_retry_after_sec').notNull().default(0),
  last_fetched_at: text('last_fetched_at'),
  last_status: text('last_status'),
  consecutive_failures: integer('consecutive_failures').notNull().default(0),
  created_at: text('created_at').notNull(),
});

/**
 * @experimental 历史回放 Top5 冻结批次表 (Top5 Freeze Batches)
 */
export const top5Batches = sqliteTable('top5_batches', {
  batch_date: text('batch_date').primaryKey(),
  frozen_at: text('frozen_at').notNull(),
  item_count: integer('item_count').notNull(),
  rule_version: text('rule_version').notNull().default('first_seen_v1'),
});

/**
 * @experimental 历史回放 Top5 项列表 (Top5 Freeze Items)
 */
export const top5BatchItems = sqliteTable('top5_batch_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  batch_date: text('batch_date').notNull(),
  evidence_id: text('evidence_id').notNull(),
  rank: integer('rank').notNull(),
  first_seen_at: text('first_seen_at').notNull(),
  frozen_at: text('frozen_at').notNull(),
});
