import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { agentSessionsTable } from "./agent-sessions";

export const compressionSnapshotsTable = sqliteTable('compression_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => agentSessionsTable.id, { onDelete: 'cascade' }),
  summaryText: text('summary_text').notNull(),
  coveredUpToMessageId: integer('covered_up_to_message_id').notNull(),
  messageCount: integer('message_count').notNull(),
  tokenCount: integer('token_count').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow()
});
