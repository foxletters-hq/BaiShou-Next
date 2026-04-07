CREATE TABLE `__drizzle_migrations` (
	`version` integer PRIMARY KEY NOT NULL,
	`tag` text NOT NULL,
	`executed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agent_assistants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`emoji` text,
	`description` text DEFAULT '',
	`avatar_path` text,
	`system_prompt` text DEFAULT '',
	`is_default` integer DEFAULT false NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`context_window` integer DEFAULT 20 NOT NULL,
	`provider_id` text,
	`model_id` text,
	`compress_token_threshold` integer DEFAULT 60000 NOT NULL,
	`compress_keep_turns` integer DEFAULT 3 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agent_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '新对话' NOT NULL,
	`vault_name` text NOT NULL,
	`assistant_id` text,
	`is_pinned` integer DEFAULT false NOT NULL,
	`system_prompt` text,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`total_input_tokens` integer DEFAULT 0 NOT NULL,
	`total_output_tokens` integer DEFAULT 0 NOT NULL,
	`total_cost_micros` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agent_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`is_summary` integer DEFAULT false NOT NULL,
	`ask_id` text,
	`provider_id` text,
	`model_id` text,
	`order_index` integer NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`cost_micros` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `agent_messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `compression_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`summary_text` text NOT NULL,
	`covered_up_to_message_id` text NOT NULL,
	`message_count` integer NOT NULL,
	`token_count` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`content` text NOT NULL,
	`source_ids` text,
	`generated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `summaries_type_start_date_end_date_unique` ON `summaries` (`type`,`start_date`,`end_date`);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
