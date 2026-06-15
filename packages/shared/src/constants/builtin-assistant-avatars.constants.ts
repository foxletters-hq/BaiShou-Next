/** 持久化内置伙伴头像路径前缀：`builtin-assistant:assistant-preset-1` */
export const BUILTIN_ASSISTANT_AVATAR_PREFIX = 'builtin-assistant:' as const

export const BUILTIN_ASSISTANT_AVATAR_IDS = [
  'assistant-preset-1',
  'assistant-preset-2',
  'assistant-preset-3',
  'assistant-preset-4',
  'assistant-preset-5'
] as const

export type BuiltinAssistantAvatarId = (typeof BUILTIN_ASSISTANT_AVATAR_IDS)[number]

export const DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID: BuiltinAssistantAvatarId = 'assistant-preset-2'

export const DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH = `${BUILTIN_ASSISTANT_AVATAR_PREFIX}${DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID}`

export function getBuiltinAssistantAvatarAssetRelativePath(id: BuiltinAssistantAvatarId): string {
  return `assets/images/assistant-presets/${id}.jpg`
}

export function isBuiltinAssistantAvatarPath(avatarPath: string | null | undefined): boolean {
  return Boolean(avatarPath?.startsWith(BUILTIN_ASSISTANT_AVATAR_PREFIX))
}

export function parseBuiltinAssistantAvatarId(
  avatarPath: string | null | undefined
): BuiltinAssistantAvatarId | null {
  if (!avatarPath?.startsWith(BUILTIN_ASSISTANT_AVATAR_PREFIX)) return null
  const id = avatarPath.slice(BUILTIN_ASSISTANT_AVATAR_PREFIX.length) as BuiltinAssistantAvatarId
  return (BUILTIN_ASSISTANT_AVATAR_IDS as readonly string[]).includes(id) ? id : null
}

export function toBuiltinAssistantAvatarPath(id: BuiltinAssistantAvatarId): string {
  return `${BUILTIN_ASSISTANT_AVATAR_PREFIX}${id}`
}
