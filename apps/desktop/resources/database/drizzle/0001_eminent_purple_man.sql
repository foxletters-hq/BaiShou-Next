ALTER TABLE `agent_assistants` ADD `assistant_kind` text DEFAULT 'companion' NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_messages` ADD `is_proactive` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `agent_messages` ADD `trigger_id` text;--> statement-breakpoint
ALTER TABLE `agent_messages` ADD `trigger_type` text;--> statement-breakpoint
ALTER TABLE `agent_messages` ADD `user_feedback` text;