import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'
import { agentMessagesTable } from './agent-messages'

export const agentPartsTable = sqliteTable(
  'agent_parts',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id')
      .notNull()
      .references(() => agentMessagesTable.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    type: text('type', {
      enum: [
        'text',
        'tool',
        'stepFinish',
        'compaction',
        'image',
        'attachment',
        'context_snapshot',
        'agent_gate',
        'file_change'
      ]
    }).notNull(),
    data: text('data', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow()
  },
  (t) => ({
    messageIdIdx: index('idx_agent_parts_message_id').on(t.messageId),
    sessionIdIdx: index('idx_agent_parts_session_id').on(t.sessionId),
    sessionTypeIdx: index('idx_agent_parts_session_type').on(t.sessionId, t.type)
  })
)
