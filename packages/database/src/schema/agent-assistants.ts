import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const agentAssistantsTable = sqliteTable('agent_assistants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  emoji: text('emoji'),
  description: text('description'),
  avatarPath: text('avatar_path'),
  systemPrompt: text('system_prompt'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  contextWindow: integer('context_window').notNull().default(10),
  providerId: text('provider_id').notNull(),
  modelId: text('model_id').notNull(),
  compressTokenThreshold: integer('compress_token_threshold').notNull().default(60000),
  compressKeepTurns: integer('compress_keep_turns').notNull().default(3),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow()
});
