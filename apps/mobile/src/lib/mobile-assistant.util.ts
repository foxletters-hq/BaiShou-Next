import type { AssistantManagerService, IAttachmentManager, IFileSystem } from '@baishou/core-mobile'
import type { InsertAssistantInput, UpdateAssistantInput } from '@baishou/database'
import {
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
  DEFAULT_ASSISTANT_KIND,
  normalizeAssistantAvatarPath,
  normalizePersistedAvatarPath,
  normalizeAssistantKind,
  type AssistantKind
} from '@baishou/shared'
import {
  peekAssistantAvatarDisplayCache,
  resolveAssistantAvatarForMobileUi,
  type ResolveAssistantAvatarOptions
} from '../lib/assistant-avatar-display.util'

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
  avatarPath?: string
  contextWindow?: number
  compressTokenThreshold?: number
  compressKeepTurns?: number
  compressSystemPrompt?: string | null
  assistantKind?: AssistantKind
  sortOrder?: number
  createdAt?: number
  lastUsedAt?: number
  useCount?: number
  displayAvatarUri?: string
}

export type ListAssistantsForUiOptions = ResolveAssistantAvatarOptions & {
  /** 跳过头像解析，仅返回元数据（最快） */
  skipAvatarResolve?: boolean
}

type AssistantRow = Awaited<ReturnType<AssistantManagerService['findAll']>>[number]

function mapAssistantRowToUi(a: AssistantRow, displayAvatarUri?: string): MobileAssistantUi {
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
    avatarPath: a.avatarPath ?? undefined,
    contextWindow: a.contextWindow ?? undefined,
    compressTokenThreshold: a.compressTokenThreshold ?? undefined,
    compressKeepTurns: a.compressKeepTurns ?? undefined,
    compressSystemPrompt: a.compressSystemPrompt,
    assistantKind: normalizeAssistantKind(a.assistantKind),
    sortOrder: a.sortOrder ?? 0,
    createdAt: a.createdAt ? new Date(a.createdAt).getTime() : undefined,
    displayAvatarUri
  }
}

export function mapAssistantRowsToUi(rows: AssistantRow[]): MobileAssistantUi[] {
  return rows.map((a) => mapAssistantRowToUi(a))
}

/** 用内存缓存同步填充 displayAvatarUri，避免列表先闪默认头像 */
export function mapAssistantRowsToUiWithCachedAvatars(
  rows: AssistantRow[],
  options?: ResolveAssistantAvatarOptions
): MobileAssistantUi[] {
  return rows.map((a) =>
    mapAssistantRowToUi(a, peekAssistantAvatarDisplayCache(a.avatarPath ?? undefined, options))
  )
}

export async function hydrateAssistantsForUi(
  rows: AssistantRow[],
  attachmentManager: IAttachmentManager,
  fileSystem: IFileSystem,
  options?: ResolveAssistantAvatarOptions
): Promise<MobileAssistantUi[]> {
  const avatarOptions: ResolveAssistantAvatarOptions = {
    preferFileUri: options?.preferFileUri ?? true
  }

  return Promise.all(
    rows.map(async (a) =>
      mapAssistantRowToUi(
        a,
        await resolveAssistantAvatarForMobileUi(
          a.avatarPath ?? undefined,
          attachmentManager,
          fileSystem,
          avatarOptions
        )
      )
    )
  )
}

export async function listAssistantsForUi(
  assistantManager: AssistantManagerService,
  attachmentManager: IAttachmentManager,
  fileSystem: IFileSystem,
  options?: ListAssistantsForUiOptions
): Promise<MobileAssistantUi[]> {
  const rows = await assistantManager.findAll()
  if (options?.skipAvatarResolve) {
    return rows.map((a) => mapAssistantRowToUi(a))
  }

  return hydrateAssistantsForUi(rows, attachmentManager, fileSystem, options)
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
  assistantKind?: AssistantKind
}): Omit<InsertAssistantInput, 'id'> {
  return {
    name: input.name,
    emoji: undefined,
    description: input.description,
    avatarPath:
      normalizePersistedAvatarPath(input.avatarPath) ||
      normalizeAssistantAvatarPath(input.avatarPath) ||
      DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
    systemPrompt: input.systemPrompt,
    isDefault: input.isDefault ?? false,
    isPinned: input.isPinned ?? false,
    contextWindow: input.contextWindow ?? -1,
    providerId: input.providerId ?? null,
    modelId: input.modelId ?? null,
    compressTokenThreshold: input.compressTokenThreshold ?? 60000,
    compressKeepTurns: input.compressKeepTurns ?? 3,
    compressSystemPrompt: input.compressSystemPrompt?.trim() || null,
    assistantKind: normalizeAssistantKind(input.assistantKind ?? DEFAULT_ASSISTANT_KIND)
  }
}

export async function findAssistantForUi(
  assistantManager: AssistantManagerService,
  attachmentManager: IAttachmentManager,
  fileSystem: IFileSystem,
  id: string,
  options?: ResolveAssistantAvatarOptions
): Promise<MobileAssistantUi | null> {
  const a = await assistantManager.findById(id)
  if (!a) return null
  return mapAssistantRowToUi(
    a,
    await resolveAssistantAvatarForMobileUi(
      a.avatarPath ?? undefined,
      attachmentManager,
      fileSystem,
      options
    )
  )
}

export function toUpdateAssistantInput(
  input: Omit<InsertAssistantInput, 'id'>
): UpdateAssistantInput {
  return input
}
