ALTER TABLE `agent_messages` ADD `cache_read_input_tokens` integer;
--> statement-breakpoint
ALTER TABLE `agent_messages` ADD `cache_write_input_tokens` integer;
--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `total_cache_read_input_tokens` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `total_cache_write_input_tokens` integer DEFAULT 0 NOT NULL;
