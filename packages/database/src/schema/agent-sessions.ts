import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const agentSessionsTable = sqliteTable('agent_sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default('新对话'),
  vaultName: text('vault_name').notNull(),
  assistantId: text('assistant_id'),
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
