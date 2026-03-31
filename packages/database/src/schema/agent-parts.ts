import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { agentMessagesTable } from "./agent-messages";

export const agentPartsTable = sqliteTable('agent_parts', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => agentMessagesTable.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  type: text('type', { enum: ['text', 'tool', 'stepFinish', 'compaction', 'attachment', 'context_snapshot'] }).notNull(),
  data: text('data', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow()
});
