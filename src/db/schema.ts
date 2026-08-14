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
