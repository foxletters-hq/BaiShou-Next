import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { agentMessagesTable } from './agent-messages'

// 主动互动触发历史表
// 调用方：packages/core/src/proactive-chat（待创建的 ProactiveChatService）
// 用途：记录每次主动触发的历史，用于频率控制、互动率统计、问题排查
// 用户指示：按照 MVP → P1 → P2 路线图实现 AI 主动互动功能，需扩展数据库 Schema

export type TriggerType = 'time_greeting' | 'diary_response' | 'silence_reminder' | 'sentiment_care'

export const proactiveTriggerHistoryTable = sqliteTable('proactive_trigger_history', {
  id: text('id').primaryKey(),
  triggerId: text('trigger_id').notNull(),
  triggerType: text('trigger_type', {
    enum: ['time_greeting', 'diary_response', 'silence_reminder', 'sentiment_care']
  }).notNull(),
  assistantId: text('assistant_id').notNull(),
  sessionId: text('session_id'),
  messageId: text('message_id').references(() => agentMessagesTable.id, {
    onDelete: 'set null'
  }),
  triggerTime: integer('trigger_time', { mode: 'timestamp' }).notNull(),
  executionSuccess: integer('execution_success', { mode: 'boolean' }).notNull(),
  errorMessage: text('error_message'),
  userInteracted: integer('user_interacted', { mode: 'boolean' }).default(false),
  interactionTime: integer('interaction_time', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow()
})
