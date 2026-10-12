CREATE TABLE `generic_artifacts` (
	`artifact_id` text PRIMARY KEY NOT NULL,
	`artifact_type` text NOT NULL,
	`updated_at` text NOT NULL,
	`content_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operator_reviews` (
	`review_id` text PRIMARY KEY NOT NULL,
	`generated_at` text NOT NULL,
	`review_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stage_diffs` (
	`diff_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`generated_at` text NOT NULL,
	`diff_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stage_snapshots` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`generated_at` text NOT NULL,
	`snapshot_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`rule_version` text NOT NULL,
	`artifact_version` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`guardrail_status` text,
	`manifest_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_briefs` (
	`report_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`generated_at` text NOT NULL,
	`report_json` text NOT NULL
);
