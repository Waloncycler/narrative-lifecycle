CREATE TABLE `narrative_memories` (
	`topic_id` text PRIMARY KEY NOT NULL,
	`first_seen_date` text,
	`last_active_date` text,
	`historical_stage_path_json` text,
	`previous_peak_stage` text,
	`previous_failed_transition` text,
	`previous_failure_reason` text,
	`previous_missing_evidence_json` text,
	`previous_friction_points_json` text,
	`previous_branch_structure_json` text,
	`is_failure_case` integer,
	`memory_confidence` integer,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`topic_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `generic_artifacts` ADD `content_md` text;