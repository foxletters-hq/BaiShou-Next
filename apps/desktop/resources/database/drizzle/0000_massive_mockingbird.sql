CREATE TABLE `agent_assistants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`emoji` text,
	`description` text,
	`avatar_path` text,
	`system_prompt` text,
	`is_default` integer DEFAULT false NOT NULL,
	`context_window` integer DEFAULT 10 NOT NULL,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`compress_token_threshold` integer DEFAULT 60000 NOT NULL,
	`compress_keep_turns` integer DEFAULT 3 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
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
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`data` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `agent_messages`(`id`) ON UPDATE no action ON DELETE cascade
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
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `compression_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`summary_text` text NOT NULL,
	`covered_up_to_message_id` integer NOT NULL,
	`message_count` integer NOT NULL,
	`token_count` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shadow_journal_index` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_path` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`content_hash` text NOT NULL,
	`weather` text,
	`mood` text,
	`location` text,
	`location_detail` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`has_media` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shadow_journal_index_file_path_unique` ON `shadow_journal_index` (`file_path`);--> statement-breakpoint
CREATE TABLE `summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`content` text NOT NULL,
	`source_ids` text,
	`generated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `summaries_type_start_date_end_date_unique` ON `summaries` (`type`,`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memory_embeddings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`embedding_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`group_id` text NOT NULL,
	`chunk_index` integer DEFAULT 0 NOT NULL,
	`chunk_text` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`embedding` blob NOT NULL,
	`dimension` integer NOT NULL,
	`model_id` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`source_created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_embeddings_embedding_id_unique` ON `memory_embeddings` (`embedding_id`);