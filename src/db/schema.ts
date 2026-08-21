import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const topics = sqliteTable('topics', {
  topic_id: text('topic_id').primaryKey(),
  topic_name: text('topic_name').notNull(),
  market_name_en: text('market_name_en'),
  status: text('status').notNull(),
  current_stage: text('current_stage').notNull(),
  domain: text('domain').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  // For JSON blobs if needed
  aliases_json: text('aliases_json'),
});

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

export const branches = sqliteTable('branches', {
  branch_id: text('branch_id').primaryKey(),
  topic_id: text('topic_id').notNull().references(() => topics.topic_id),
  market_name_zh: text('market_name_zh').notNull(),
  market_name_en: text('market_name_en'),
  naming_status: text('naming_status').notNull(),
  created_at: text('created_at').notNull(),
});

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
  // Storing the arrays as JSON strings
  affected_layer_json: text('affected_layer_json').notNull(),
}, (table) => {
  return {
    topicIdx: index('idx_evidence_topic').on(table.topic_id),
    branchIdx: index('idx_evidence_branch').on(table.branch_id),
  };
});

// Since raw documents text can be huge, we can store it in DB, or store paths. 
// For SQLite, TEXT fields can hold up to 1GB. We can store it here directly for unification.
export const rawDocuments = sqliteTable('raw_documents', {
  raw_document_id: text('raw_document_id').primaryKey(),
  source_name: text('source_name').notNull(),
  source_kind: text('source_kind').notNull(),
  ingested_at: text('ingested_at').notNull(),
  text: text('text').notNull(),
  character_count: integer('character_count').notNull(),
});

export const intakeSessions = sqliteTable('intake_sessions', {
  session_id: text('session_id').primaryKey(),
  generated_at: text('generated_at').notNull(),
  raw_document_id: text('raw_document_id').references(() => rawDocuments.raw_document_id),
  // Storing full complex objects as JSON strings in SQLite. 
  // In PostgreSQL, these would be JSONB.
  chunks_json: text('chunks_json'),
  provenance_records_json: text('provenance_records_json'),
  candidates_json: text('candidates_json'),
  ai_shadow_candidates_json: text('ai_shadow_candidates_json'),
  candidate_comparisons_json: text('candidate_comparisons_json'),
  review_template_json: text('review_template_json'),
});

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

export const stageSnapshots = sqliteTable('stage_snapshots', {
  snapshot_id: text('snapshot_id').primaryKey(),
  run_id: text('run_id').notNull(),
  generated_at: text('generated_at').notNull(),
  snapshot_json: text('snapshot_json').notNull(),
});

export const stageDiffs = sqliteTable('stage_diffs', {
  diff_id: text('diff_id').primaryKey(),
  run_id: text('run_id').notNull(),
  generated_at: text('generated_at').notNull(),
  diff_json: text('diff_json').notNull(),
});

export const weeklyBriefs = sqliteTable('weekly_briefs', {
  report_id: text('report_id').primaryKey(),
  run_id: text('run_id').notNull(),
  generated_at: text('generated_at').notNull(),
  report_json: text('report_json').notNull(),
});

export const operatorReviews = sqliteTable('operator_reviews', {
  review_id: text('review_id').primaryKey(),
  generated_at: text('generated_at').notNull(),
  review_json: text('review_json').notNull(),
});

// A catch-all table for research atlases, registries, audits, and ledgers
export const genericArtifacts = sqliteTable('generic_artifacts', {
  artifact_id: text('artifact_id').primaryKey(), // e.g., 'source_atlas_latest', 'pilot_ledger_latest'
  artifact_type: text('artifact_type').notNull(), // e.g., 'source_atlas', 'company_registry', 'audit'
  updated_at: text('updated_at').notNull(),
  content_json: text('content_json').notNull(),
  content_md: text('content_md'), // Optional raw markdown text
});

// ---------------------------------------------------------------------------
// SignalRadar-ported tables: Source Governance, Collection Audit, Raw Snapshots,
// Canonical Events, Decision Ledger, Knowledge & Feedback
// ---------------------------------------------------------------------------

/**
 * Source governance: signal/baseline role, P0/P1/P2 priority, ETag/cursor
 * persistence, license tracking, and auto-disable on consecutive failures.
 * Ported from SignalRadar `source` table.
 */
export const sourceGovernance = sqliteTable('source_governance', {
  source_id: text('source_id').primaryKey(),
  source_name: text('source_name').notNull(),
  adapter_type: text('adapter_type').notNull(),
  role: text('role').notNull().default('signal'), // 'signal' | 'baseline'
  url: text('url'),
  priority: text('priority').notNull().default('P1'), // 'P0' | 'P1' | 'P2'
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
 * Per-fetch audit trail: records every HTTP request's outcome, duration,
 * cursor delta, and HTTP status for full observability.
 * Ported from SignalRadar `collection_attempt` table.
 */
export const collectionAttempts = sqliteTable('collection_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source_id: text('source_id').notNull(),
  operation_id: text('operation_id'),
  started_at: text('started_at').notNull(),
  ended_at: text('ended_at'),
  duration_sec: text('duration_sec'), // stored as text for REAL compatibility
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
 * Raw HTTP response body storage for full evidence traceability.
 * Every fetched payload is stored verbatim; content_hash provides
 * idempotent deduplication via SHA-256.
 * Ported from SignalRadar `raw_snapshot` table.
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
 * Canonical event: deduplicates multiple reports about the same real-world event.
 * Events are matched via URL normalization, title normalization, or keyword similarity.
 * Ported from SignalRadar `canonical_event` table.
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
 * Maps evidence candidates to canonical events, tracking match method and similarity.
 * Ported from SignalRadar `candidate_event_membership` table.
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

/**
 * Sliding-window observation of event activity: mention_count and
 * distinct_source_count over 24h/72h/7d windows for resonance detection.
 * Ported from SignalRadar `event_observation` table.
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
 * Falsifiable prediction ledger: every thesis must declare a predicted observation,
 * a falsifier (kill condition), and a horizon deadline. Entries resolve as
 * confirmed/refuted/expired.
 * Ported from SignalRadar `decision_ledger` table.
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
 * Pre-freeze daily top-5 batch for replay evaluation.
 * Ported from SignalRadar `top5_batch` + `top5_batch_item`.
 */
export const top5Batches = sqliteTable('top5_batches', {
  batch_date: text('batch_date').primaryKey(),
  frozen_at: text('frozen_at').notNull(),
  item_count: integer('item_count').notNull(),
  rule_version: text('rule_version').notNull().default('first_seen_v1'),
});

export const top5BatchItems = sqliteTable('top5_batch_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  batch_date: text('batch_date').notNull(),
  evidence_id: text('evidence_id').notNull(),
  rank: integer('rank').notNull(),
  first_seen_at: text('first_seen_at').notNull(),
  frozen_at: text('frozen_at').notNull(),
});

/**
 * Private knowledge edge: user's field notes, preferences, anomalies, and
 * hypotheses stored locally. Injected into LLM context when influence_enabled=1.
 * Ported from SignalRadar `knowledge_entry` table.
 */
export const knowledgeEntries = sqliteTable('knowledge_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind').notNull(), // 'field_note' | 'preference' | 'private_observation' | 'anomaly' | 'hypothesis' | 'document'
  content: text('content').notNull(),
  original_filename: text('original_filename'),
  media_type: text('media_type'),
  influence_enabled: integer('influence_enabled').notNull().default(1),
  created_at: text('created_at').notNull(),
});

/**
 * Append-only user feedback on evidence quality.
 * Ported from SignalRadar `feedback_event` table.
 */
export const feedbackEvents = sqliteTable('feedback_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evidence_id: text('evidence_id').notNull(),
  feedback_type: text('feedback_type').notNull(), // 'valuable' | 'already_known' | 'noise' | 'weak_evidence' | 'deep_dive' | 'acted' | 'wrong'
  note: text('note'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  evidenceIdx: index('idx_fe_evidence').on(table.evidence_id),
}));
