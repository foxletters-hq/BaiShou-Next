import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const agentSessionsTable = sqliteTable('agent_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  vaultName: text('vault_name').notNull(),
  assistantId: integer('assistant_id').notNull(),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  systemPrompt: text('system_prompt'),
  providerId: text('provider_id').notNull(),
  modelId: text('model_id').notNull(),
  totalInputTokens: integer('total_input_tokens').notNull().default(0),
  totalOutputTokens: integer('total_output_tokens').notNull().default(0),
  totalCostMicros: integer('total_cost_micros').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow()
});
