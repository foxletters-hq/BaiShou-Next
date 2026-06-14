import type { AssistantManagerService, IAttachmentManager, IFileSystem } from '@baishou/core-mobile'
import type { InsertAssistantInput, UpdateAssistantInput } from '@baishou/database'
import { ASSISTANT_DEFAULT_AVATAR_SENTINEL } from '@baishou/shared'
import { resolveAssistantAvatarForMobileUi } from '../lib/assistant-avatar-display.util'

export type MobileAssistantUi = {
  id: string
  name: string
  emoji: string
  description?: string
  systemPrompt?: string
  isDefault: boolean
  isPinned: boolean
  providerId?: string
  modelId?: string
  avatarPath?: string | null
  contextWindow?: number
  compressTokenThreshold?: number
  compressKeepTurns?: number
  compressSystemPrompt?: string | null
  createdAt?: number
  lastUsedAt?: number
  useCount?: number
  displayAvatarUri?: string
}

export function buildAssistantRepoInput(input: {
  name: string
  emoji?: string
  description?: string
  systemPrompt?: string
  isDefault?: boolean
  isPinned?: boolean
  providerId?: string | null
  modelId?: string | null
  avatarPath?: string | null
  contextWindow?: number
  compressTokenThreshold?: number
  compressKeepTurns?: number
  compressSystemPrompt?: string | null
}): Omit<InsertAssistantInput, 'id'> {
  const emoji = input.emoji?.trim()
  const avatarPath = input.avatarPath
  return {
    name: input.name,
    emoji: emoji || undefined,
    description: input.description,
    avatarPath:
      emoji || !avatarPath || avatarPath === ASSISTANT_DEFAULT_AVATAR_SENTINEL
        ? undefined
        : avatarPath,
    systemPrompt: input.systemPrompt,
    isDefault: input.isDefault ?? false,
    isPinned: input.isPinned ?? false,
    contextWindow: input.contextWindow ?? -1,
    providerId: input.providerId ?? null,
    modelId: input.modelId ?? null,
    compressTokenThreshold: input.compressTokenThreshold ?? 60000,
    compressKeepTurns: input.compressKeepTurns ?? 3,
    compressSystemPrompt: input.compressSystemPrompt?.trim() || null
  }
}

export async function listAssistantsForUi(
  assistantManager: AssistantManagerService,
  attachmentManager: IAttachmentManager,
  fileSystem: IFileSystem
): Promise<MobileAssistantUi[]> {
  const rows = await assistantManager.findAll()
  return Promise.all(
    rows.map(async (a) => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji || '',
      description: a.description ?? undefined,
      systemPrompt: a.systemPrompt ?? undefined,
      isDefault: a.isDefault,
      isPinned: a.isPinned,
      providerId: a.providerId ?? undefined,
      modelId: a.modelId ?? undefined,
      avatarPath: a.avatarPath,
      contextWindow: a.contextWindow ?? undefined,
      compressTokenThreshold: a.compressTokenThreshold ?? undefined,
      compressKeepTurns: a.compressKeepTurns ?? undefined,
      compressSystemPrompt: a.compressSystemPrompt,
      createdAt: a.createdAt ? new Date(a.createdAt).getTime() : undefined,
      lastUsedAt: a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : undefined,
      useCount: a.useCount ?? undefined,
      displayAvatarUri: await resolveAssistantAvatarForMobileUi(
        a.avatarPath ?? undefined,
        attachmentManager,
        fileSystem
      )
    }))
  )
}

export async function findAssistantForUi(
  assistantManager: AssistantManagerService,
  attachmentManager: IAttachmentManager,
  fileSystem: IFileSystem,
  id: string
): Promise<MobileAssistantUi | null> {
  const a = await assistantManager.findById(id)
  if (!a) return null
  return {
    id: a.id,
    name: a.name,
    emoji: a.emoji || '',
    description: a.description ?? undefined,
    systemPrompt: a.systemPrompt ?? undefined,
    isDefault: a.isDefault,
    isPinned: a.isPinned,
    providerId: a.providerId ?? undefined,
    modelId: a.modelId ?? undefined,
    avatarPath: a.avatarPath,
    contextWindow: a.contextWindow ?? undefined,
    compressTokenThreshold: a.compressTokenThreshold ?? undefined,
    compressKeepTurns: a.compressKeepTurns ?? undefined,
    compressSystemPrompt: a.compressSystemPrompt,
    displayAvatarUri: await resolveAssistantAvatarForMobileUi(
      a.avatarPath ?? undefined,
      attachmentManager,
      fileSystem
    )
  }
}

export function toUpdateAssistantInput(
  input: Omit<InsertAssistantInput, 'id'>
): UpdateAssistantInput {
  return input
}
