import { eq, desc, asc } from 'drizzle-orm'
import {
  DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS,
  DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
  DEFAULT_ASSISTANT_CONTEXT_WINDOW
} from '@baishou/shared'
import { AppDatabase } from '../types'
import { agentAssistantsTable } from '../schema/agent-assistants'
import { withExpoAgentDatabaseLock } from '../expo-agent-db.lock'

export interface InsertAssistantInput {
  id: string
  name: string
  emoji?: string
  description?: string
  avatarPath?: string
  systemPrompt?: string
  isDefault?: boolean
  isPinned?: boolean
  contextWindow?: number
  providerId?: string | null
  modelId?: string | null
  compressTokenThreshold?: number
  compressKeepTurns?: number
  compressModelContextWindow?: number | null
  compressPreserveRecentTokens?: number | null
  compressSystemPrompt?: string | null
  assistantKind?: string
  emojiGroupId?: string | null
  emojiEnabled?: boolean
  emojiGroupIds?: string | null
  sortOrder?: number
}

export type UpdateAssistantInput = Partial<Omit<InsertAssistantInput, 'id'>>

export class AssistantRepository {
  constructor(private readonly db: AppDatabase) {}

  private run<T>(fn: () => Promise<T>): Promise<T> {
    return withExpoAgentDatabaseLock(this.db, fn)
  }

  /**
   * 按排序和创建时间拉取所有助手
   */
  async findAll() {
    return this.run(() =>
      this.db
        .select()
        .from(agentAssistantsTable)
        .orderBy(asc(agentAssistantsTable.sortOrder), desc(agentAssistantsTable.updatedAt))
    )
  }

  /**
   * 按 ID 查找特定助手
   */
  async findById(id: string) {
    return this.run(async () => {
      const result = await this.db
        .select()
        .from(agentAssistantsTable)
        .where(eq(agentAssistantsTable.id, id))
        .limit(1)

      return result[0]
    })
  }

  /**
   * 创建新的助手
   */
  async create(input: InsertAssistantInput): Promise<void> {
    await this.run(() =>
      this.db
        .insert(agentAssistantsTable)
        .values({
          id: input.id,
          name: input.name,
          emoji: input.emoji,
          description: input.description,
          avatarPath: input.avatarPath,
          systemPrompt: input.systemPrompt,
          isDefault: input.isDefault ?? false,
          isPinned: input.isPinned ?? false,
          contextWindow: input.contextWindow ?? DEFAULT_ASSISTANT_CONTEXT_WINDOW,
          providerId: input.providerId,
          modelId: input.modelId,
          compressTokenThreshold:
            input.compressTokenThreshold ?? DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
          compressKeepTurns: input.compressKeepTurns ?? DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS,
          compressModelContextWindow: input.compressModelContextWindow ?? null,
          compressPreserveRecentTokens: input.compressPreserveRecentTokens ?? null,
          compressSystemPrompt: input.compressSystemPrompt ?? null,
          assistantKind: input.assistantKind ?? 'companion',
          emojiGroupId: input.emojiGroupId ?? null,
          emojiEnabled: input.emojiEnabled ?? false,
          emojiGroupIds: input.emojiGroupIds ?? null,
          sortOrder: input.sortOrder ?? 0,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .onConflictDoNothing()
    )
  }

  /**
   * 更新某个助手
   */
  async update(id: string, input: UpdateAssistantInput): Promise<void> {
    await this.run(async () => {
      const result = await this.db
        .select()
        .from(agentAssistantsTable)
        .where(eq(agentAssistantsTable.id, id))
        .limit(1)
      if (!result[0]) return

      const patch: Record<string, unknown> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.emoji !== undefined) patch.emoji = input.emoji
      if (input.description !== undefined) patch.description = input.description
      if (input.avatarPath !== undefined) patch.avatarPath = input.avatarPath
      if (input.systemPrompt !== undefined) patch.systemPrompt = input.systemPrompt
      if (input.isDefault !== undefined) patch.isDefault = input.isDefault
      if (input.isPinned !== undefined) patch.isPinned = input.isPinned
      if (input.contextWindow !== undefined) patch.contextWindow = input.contextWindow
      if (input.providerId !== undefined) patch.providerId = input.providerId
      if (input.modelId !== undefined) patch.modelId = input.modelId
      if (input.compressTokenThreshold !== undefined) {
        patch.compressTokenThreshold = input.compressTokenThreshold
      }
      if (input.compressKeepTurns !== undefined) patch.compressKeepTurns = input.compressKeepTurns
      if (input.compressModelContextWindow !== undefined) {
        patch.compressModelContextWindow = input.compressModelContextWindow
      }
      if (input.compressPreserveRecentTokens !== undefined) {
        patch.compressPreserveRecentTokens = input.compressPreserveRecentTokens
      }
      if (input.compressSystemPrompt !== undefined) {
        patch.compressSystemPrompt = input.compressSystemPrompt
      }
      if (input.assistantKind !== undefined) patch.assistantKind = input.assistantKind
      if (input.emojiGroupId !== undefined) patch.emojiGroupId = input.emojiGroupId
      if (input.emojiEnabled !== undefined) patch.emojiEnabled = input.emojiEnabled
      if (input.emojiGroupIds !== undefined) patch.emojiGroupIds = input.emojiGroupIds
      if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder

      await this.db
        .update(agentAssistantsTable)
        .set({
          ...patch,
          updatedAt: new Date()
        })
        .where(eq(agentAssistantsTable.id, id))
    })
  }

  /**
   * 切换助手的置顶状态
   */
  async togglePin(id: string, isPinned: boolean): Promise<void> {
    await this.run(() =>
      this.db
        .update(agentAssistantsTable)
        .set({
          isPinned,
          updatedAt: new Date()
        })
        .where(eq(agentAssistantsTable.id, id))
    )
  }

  /**
   * 删除指定的助手
   */
  async delete(id: string): Promise<void> {
    await this.run(() => this.db.delete(agentAssistantsTable).where(eq(agentAssistantsTable.id, id)))
  }
}
