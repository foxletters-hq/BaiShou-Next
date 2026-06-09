import type { AssistantManagerService, SettingsManagerService } from '@baishou/core-mobile'
import type { InsertAssistantInput } from '@baishou/database'
import { ASSISTANT_DEFAULT_AVATAR_SENTINEL } from '@baishou/shared'

interface SettingsAssistant {
  id: string
  name: string
  emoji?: string
  description?: string
  systemPrompt?: string
  isDefault?: boolean
  isPinned?: boolean
  providerId?: string
  modelId?: string
  avatarPath?: string
  contextWindow?: number
  compressTokenThreshold?: number
  compressKeepTurns?: number
  compressSystemPrompt?: string | null
}

function toRepoAvatarPath(avatarPath?: string, emoji?: string): string | undefined {
  if (emoji?.trim()) return undefined
  if (!avatarPath || avatarPath === ASSISTANT_DEFAULT_AVATAR_SENTINEL) return undefined
  return avatarPath
}

function toRepoInput(a: SettingsAssistant): Omit<InsertAssistantInput, 'id'> {
  return {
    name: a.name,
    emoji: a.emoji || undefined,
    description: a.description,
    avatarPath: toRepoAvatarPath(a.avatarPath, a.emoji),
    systemPrompt: a.systemPrompt,
    isDefault: a.isDefault ?? false,
    isPinned: a.isPinned ?? false,
    contextWindow: a.contextWindow ?? -1,
    providerId: a.providerId ?? null,
    modelId: a.modelId ?? null,
    compressTokenThreshold: a.compressTokenThreshold ?? 60000,
    compressKeepTurns: a.compressKeepTurns ?? 3,
    compressSystemPrompt: a.compressSystemPrompt?.trim() || null
  }
}

/**
 * 移动端伙伴 UI 以 settings 为 SSOT，但压缩/上下文等管线读 SQLite assistant 表。
 * 将 settings 中的伙伴列表同步到 AssistantRepository（对齐桌面端 assistantManager）。
 */
export async function syncSettingsAssistantsToRepo(
  settingsManager: SettingsManagerService,
  assistantManager: AssistantManagerService
): Promise<void> {
  const assistants = (await settingsManager.get<SettingsAssistant[]>('assistants')) || []

  for (const assistant of assistants) {
    const input = toRepoInput(assistant)
    const existing = await assistantManager.findById(assistant.id)
    if (existing) {
      await assistantManager.update(assistant.id, input)
    } else {
      await assistantManager.create({ id: assistant.id, ...input })
    }
  }
}
