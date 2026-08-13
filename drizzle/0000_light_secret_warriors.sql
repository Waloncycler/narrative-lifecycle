CREATE TABLE `branches` (
	`branch_id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`market_name_zh` text NOT NULL,
	`market_name_en` text,
	`naming_status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`topic_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `evidence` (
	`evidence_id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`branch_id` text,
	`event_date` text NOT NULL,
	`available_at` text NOT NULL,
	`event_title` text NOT NULL,
	`event_summary` text,
	`event_type` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text,
	`source_type` text,
	`evidence_strength` text NOT NULL,
	`stage_effect` text NOT NULL,
	`parent_or_branch` text,
	`interpretation` text,
	`limitation` text,
	`positive_or_negative` text,
	`confidence` integer,
	`affected_layer_json` text NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`topic_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_topic` ON `evidence` (`topic_id`);--> statement-breakpoint
CREATE INDEX `idx_evidence_branch` ON `evidence` (`branch_id`);--> statement-breakpoint
CREATE TABLE `intake_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`generated_at` text NOT NULL,
	`raw_document_id` text,
	`chunks_json` text,
	`provenance_records_json` text,
	`candidates_json` text,
	`ai_shadow_candidates_json` text,
	`candidate_comparisons_json` text,
	`review_template_json` text,
	FOREIGN KEY (`raw_document_id`) REFERENCES `raw_documents`(`raw_document_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `raw_documents` (
	`raw_document_id` text PRIMARY KEY NOT NULL,
	`source_name` text NOT NULL,
	`source_kind` text NOT NULL,
	`ingested_at` text NOT NULL,
	`text` text NOT NULL,
	`character_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`topic_id` text PRIMARY KEY NOT NULL,
	`topic_name` text NOT NULL,
	`market_name_en` text,
	`status` text NOT NULL,
	`current_stage` text NOT NULL,
	`domain` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`aliases_json` text
);
