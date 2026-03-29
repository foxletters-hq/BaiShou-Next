import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { agentMessagesTable } from "./agent-messages";

export const agentPartsTable = sqliteTable('agent_parts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: integer('message_id').notNull().references(() => agentMessagesTable.id, { onDelete: 'cascade' }),
  sessionId: integer('session_id').notNull(),
  type: text('type', { enum: ['text', 'tool', 'stepFinish', 'compaction'] }).notNull(),
  data: text('data', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow()
});
