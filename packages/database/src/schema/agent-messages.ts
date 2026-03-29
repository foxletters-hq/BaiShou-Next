import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { agentSessionsTable } from "./agent-sessions";

export const agentMessagesTable = sqliteTable('agent_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => agentSessionsTable.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['system', 'user', 'assistant', 'tool'] }).notNull(),
  isSummary: integer('is_summary', { mode: 'boolean' }).notNull().default(false),
  askId: text('ask_id'),
  providerId: text('provider_id'),
  modelId: text('model_id'),
  orderIndex: integer('order_index').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costMicros: integer('cost_micros'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow()
});
