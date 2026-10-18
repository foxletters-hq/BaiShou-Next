/** 持久化内置伙伴头像路径前缀：`builtin-assistant:assistant-preset-1` */
export const BUILTIN_ASSISTANT_AVATAR_PREFIX = 'builtin-assistant:' as const

export const BUILTIN_ASSISTANT_AVATAR_IDS = ['assistant-preset-6'] as const

export type BuiltinAssistantAvatarId = (typeof BUILTIN_ASSISTANT_AVATAR_IDS)[number]

export const DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID: BuiltinAssistantAvatarId = 'assistant-preset-6'

export const DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH = `${BUILTIN_ASSISTANT_AVATAR_PREFIX}${DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID}`

export function getBuiltinAssistantAvatarAssetRelativePath(id: BuiltinAssistantAvatarId): string {
  return `assets/images/assistant-presets/${id}.jpg`
}

export function isBuiltinAssistantAvatarPath(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return false
  return (
    avatarPath.startsWith(BUILTIN_ASSISTANT_AVATAR_PREFIX) || avatarPath.startsWith('builtin-user:')
  )
}

export function parseBuiltinAssistantAvatarId(
  avatarPath: string | null | undefined
): BuiltinAssistantAvatarId | null {
  if (!avatarPath) return null
  const trimmed = avatarPath.trim()
  if (trimmed.startsWith(BUILTIN_ASSISTANT_AVATAR_PREFIX)) {
    const id = trimmed.slice(BUILTIN_ASSISTANT_AVATAR_PREFIX.length) as BuiltinAssistantAvatarId
    if ((BUILTIN_ASSISTANT_AVATAR_IDS as readonly string[]).includes(id)) return id
    if (id.startsWith('assistant-preset-')) return DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID
    return null
  }
  if (trimmed.startsWith('builtin-user:')) {
    return DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID
  }
  return null
}

export function toBuiltinAssistantAvatarPath(id: BuiltinAssistantAvatarId): string {
  return `${BUILTIN_ASSISTANT_AVATAR_PREFIX}${id}`
}
