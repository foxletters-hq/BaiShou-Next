CREATE TABLE IF NOT EXISTS `memory_embeddings` (
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
CREATE UNIQUE INDEX IF NOT EXISTS `memory_embeddings_embedding_id_unique` ON `memory_embeddings` (`embedding_id`);