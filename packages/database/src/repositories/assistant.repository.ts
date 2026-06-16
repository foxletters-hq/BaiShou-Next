import { eq, desc, asc } from 'drizzle-orm'
import { AppDatabase } from '../types'
import { agentAssistantsTable } from '../schema/agent-assistants'

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
  sortOrder?: number
}

export type UpdateAssistantInput = Partial<Omit<InsertAssistantInput, 'id'>>

export class AssistantRepository {
  constructor(private readonly db: AppDatabase) {}

  /**
   * 按排序和创建时间拉取所有助手
   */
  async findAll() {
    return await this.db
      .select()
      .from(agentAssistantsTable)
      .orderBy(asc(agentAssistantsTable.sortOrder), desc(agentAssistantsTable.updatedAt))
  }

  /**
   * 按 ID 查找特定助手
   */
  async findById(id: string) {
    const result = await this.db
      .select()
      .from(agentAssistantsTable)
      .where(eq(agentAssistantsTable.id, id))
      .limit(1)

    return result[0]
  }

  /**
   * 创建新的助手
   */
  async create(input: InsertAssistantInput): Promise<void> {
    await this.db
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
        contextWindow: input.contextWindow ?? 10,
        providerId: input.providerId,
        modelId: input.modelId,
        compressTokenThreshold: input.compressTokenThreshold ?? 60000,
        compressKeepTurns: input.compressKeepTurns ?? 3,
        compressModelContextWindow: input.compressModelContextWindow ?? null,
        compressPreserveRecentTokens: input.compressPreserveRecentTokens ?? null,
        compressSystemPrompt: input.compressSystemPrompt ?? null,
        assistantKind: input.assistantKind ?? 'companion',
        sortOrder: input.sortOrder ?? 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoNothing()
  }

  /**
   * 更新某个助手
   */
  async update(id: string, input: UpdateAssistantInput): Promise<void> {
    const target = await this.findById(id)
    if (!target) return

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
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder

    await this.db
      .update(agentAssistantsTable)
      .set({
        ...patch,
        updatedAt: new Date()
      })
      .where(eq(agentAssistantsTable.id, id))
  }

  /**
   * 切换助手的置顶状态
   */
  async togglePin(id: string, isPinned: boolean): Promise<void> {
    await this.db
      .update(agentAssistantsTable)
      .set({
        isPinned,
        updatedAt: new Date()
      })
      .where(eq(agentAssistantsTable.id, id))
  }

  /**
   * 删除指定的助手
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(agentAssistantsTable).where(eq(agentAssistantsTable.id, id))
  }
}
