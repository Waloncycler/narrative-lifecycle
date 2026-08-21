CREATE TABLE `canonical_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_key` text NOT NULL,
	`title` text NOT NULL,
	`normalized_title` text NOT NULL,
	`canonical_url` text,
	`first_observed_at` text NOT NULL,
	`last_observed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canonical_events_event_key_unique` ON `canonical_events` (`event_key`);--> statement-breakpoint
CREATE TABLE `collection_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`operation_id` text,
	`started_at` text NOT NULL,
	`ended_at` text,
	`duration_sec` text,
	`status` text NOT NULL,
	`http_status_code` integer,
	`snapshots_new` integer DEFAULT 0 NOT NULL,
	`snapshots_dup` integer DEFAULT 0 NOT NULL,
	`cursor_before` text,
	`cursor_after` text,
	`error_msg` text,
	`is_failure` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ca_source_started` ON `collection_attempts` (`source_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `decision_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ledger_key` text NOT NULL,
	`decision_kind` text NOT NULL,
	`topic_id` text,
	`branch_id` text,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`title` text NOT NULL,
	`thesis` text NOT NULL,
	`predicted_observation` text NOT NULL,
	`affected_layers` text,
	`falsifier` text NOT NULL,
	`horizon_at` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`result_note` text,
	`system_prediction` text,
	`user_prediction` text,
	`user_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `decision_ledger_ledger_key_unique` ON `decision_ledger` (`ledger_key`);--> statement-breakpoint
CREATE INDEX `idx_dl_status` ON `decision_ledger` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dl_topic` ON `decision_ledger` (`topic_id`);--> statement-breakpoint
CREATE TABLE `event_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`observed_at` text NOT NULL,
	`window_hours` integer NOT NULL,
	`mention_count` integer DEFAULT 0 NOT NULL,
	`distinct_source_count` integer DEFAULT 0 NOT NULL,
	`latest_member_seen_at` text
);
--> statement-breakpoint
CREATE TABLE `evidence_event_membership` (
	`evidence_id` text PRIMARY KEY NOT NULL,
	`event_id` integer NOT NULL,
	`match_method` text NOT NULL,
	`similarity` text DEFAULT '1.0' NOT NULL,
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_eem_event` ON `evidence_event_membership` (`event_id`);--> statement-breakpoint
CREATE TABLE `feedback_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`evidence_id` text NOT NULL,
	`feedback_type` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_fe_evidence` ON `feedback_events` (`evidence_id`);--> statement-breakpoint
CREATE TABLE `knowledge_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`original_filename` text,
	`media_type` text,
	`influence_enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `raw_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text NOT NULL,
	`fetched_at` text NOT NULL,
	`source_published_at` text,
	`raw_url` text,
	`content_type` text DEFAULT 'json' NOT NULL,
	`raw_body` text,
	`content_hash` text,
	`normalized_evidence_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_governance` (
	`source_id` text PRIMARY KEY NOT NULL,
	`source_name` text NOT NULL,
	`adapter_type` text NOT NULL,
	`role` text DEFAULT 'signal' NOT NULL,
	`url` text,
	`priority` text DEFAULT 'P1' NOT NULL,
	`poll_interval_sec` integer DEFAULT 3600 NOT NULL,
	`license_status` text DEFAULT 'unknown' NOT NULL,
	`license_note` text,
	`enabled` integer DEFAULT 1 NOT NULL,
	`etag` text,
	`last_modified` text,
	`cursor` text,
	`pending_retry_after_sec` integer DEFAULT 0 NOT NULL,
	`last_fetched_at` text,
	`last_status` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `top5_batch_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_date` text NOT NULL,
	`evidence_id` text NOT NULL,
	`rank` integer NOT NULL,
	`first_seen_at` text NOT NULL,
	`frozen_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `top5_batches` (
	`batch_date` text PRIMARY KEY NOT NULL,
	`frozen_at` text NOT NULL,
	`item_count` integer NOT NULL,
	`rule_version` text DEFAULT 'first_seen_v1' NOT NULL
);
