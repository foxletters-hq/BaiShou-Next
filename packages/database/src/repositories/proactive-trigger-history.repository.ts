import { eq, and, gte, lte, desc } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { proactiveTriggerHistoryTable } from '../schema/proactive-trigger-history'
import type { TriggerType } from '../schema/proactive-trigger-history'
import { nanoid } from 'nanoid'

// 主动触发历史仓储：负责主动触发历史的增删改查
// 调用方：packages/core/src/proactive-chat/service.ts（ProactiveChatService 通过依赖注入）
// API：create、findByTriggerId、findByDateRange、getTodayCount、updateUserInteraction
// 数据结构：操作 proactive_trigger_history 表（packages/database/src/schema/proactive-trigger-history.ts）
// 用户指示：按 MVP → P1 → P2 实现 AI 主动互动，使用 TDD 红→绿→重构，遵守项目规范

export interface CreateProactiveTriggerHistoryInput {
  triggerId: string
  triggerType: TriggerType
  assistantId: string
  sessionId?: string
  messageId?: string
  triggerTime: Date
  executionSuccess: boolean
  errorMessage?: string
  userInteracted?: boolean
  interactionTime?: Date
}

export interface UpdateUserInteractionInput {
  id: string
  userInteracted: boolean
  interactionTime: Date
}

export class ProactiveTriggerHistoryRepository {
  constructor(private db: LibSQLDatabase<Record<string, never>>) {}

  async create(input: CreateProactiveTriggerHistoryInput) {
    const id = nanoid()
    const now = new Date()

    await this.db.insert(proactiveTriggerHistoryTable).values({
      id,
      triggerId: input.triggerId,
      triggerType: input.triggerType,
      assistantId: input.assistantId,
      sessionId: input.sessionId,
      messageId: input.messageId,
      triggerTime: input.triggerTime,
      executionSuccess: input.executionSuccess,
      errorMessage: input.errorMessage,
      userInteracted: input.userInteracted ?? false,
      interactionTime: input.interactionTime,
      createdAt: now
    })

    return id
  }

  async findByTriggerId(triggerId: string) {
    return this.db
      .select()
      .from(proactiveTriggerHistoryTable)
      .where(eq(proactiveTriggerHistoryTable.triggerId, triggerId))
      .orderBy(desc(proactiveTriggerHistoryTable.triggerTime))
      .all()
  }

  async findByDateRange(startDate: Date, endDate: Date) {
    return this.db
      .select()
      .from(proactiveTriggerHistoryTable)
      .where(
        and(
          gte(proactiveTriggerHistoryTable.triggerTime, startDate),
          lte(proactiveTriggerHistoryTable.triggerTime, endDate)
        )
      )
      .orderBy(desc(proactiveTriggerHistoryTable.triggerTime))
      .all()
  }

  async getTodayCount(assistantId?: string): Promise<number> {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const conditions = [gte(proactiveTriggerHistoryTable.triggerTime, todayStart)]

    if (assistantId) {
      conditions.push(eq(proactiveTriggerHistoryTable.assistantId, assistantId))
    }

    const result = await this.db
      .select()
      .from(proactiveTriggerHistoryTable)
      .where(and(...conditions))
      .all()

    return result.length
  }

  async updateUserInteraction(input: UpdateUserInteractionInput) {
    await this.db
      .update(proactiveTriggerHistoryTable)
      .set({
        userInteracted: input.userInteracted,
        interactionTime: input.interactionTime
      })
      .where(eq(proactiveTriggerHistoryTable.id, input.id))
      .run()
  }

  async deleteByTriggerId(triggerId: string) {
    await this.db
      .delete(proactiveTriggerHistoryTable)
      .where(eq(proactiveTriggerHistoryTable.triggerId, triggerId))
      .run()
  }

  async findLatestByAssistant(assistantId: string, limit = 10) {
    return this.db
      .select()
      .from(proactiveTriggerHistoryTable)
      .where(eq(proactiveTriggerHistoryTable.assistantId, assistantId))
      .orderBy(desc(proactiveTriggerHistoryTable.triggerTime))
      .limit(limit)
      .all()
  }
}
