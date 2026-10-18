import { BUILTIN_ASSISTANT_AVATAR_PREFIX } from './builtin-assistant-avatars.constants'

/** 持久化中表示「使用应用默认头像」的占位值 */
export const USER_DEFAULT_AVATAR_SENTINEL = 'default'

/** 持久化内置用户头像路径前缀：`builtin-user:user-preset-6` */
export const BUILTIN_USER_AVATAR_PREFIX = 'builtin-user:' as const

export const BUILTIN_USER_AVATAR_IDS = ['user-preset-6'] as const

export type BuiltinUserAvatarId = (typeof BUILTIN_USER_AVATAR_IDS)[number]

export const DEFAULT_BUILTIN_USER_AVATAR_ID: BuiltinUserAvatarId = 'user-preset-6'

export const DEFAULT_BUILTIN_USER_AVATAR_PATH = `${BUILTIN_USER_AVATAR_PREFIX}${DEFAULT_BUILTIN_USER_AVATAR_ID}`

export function isBuiltinUserAvatarPath(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return false
  const trimmed = avatarPath.trim()
  if (trimmed === USER_DEFAULT_AVATAR_SENTINEL) return true
  return Boolean(parseBuiltinUserAvatarId(trimmed))
}

export function parseBuiltinUserAvatarId(
  avatarPath: string | null | undefined
): BuiltinUserAvatarId | null {
  if (!avatarPath) return null
  const trimmed = avatarPath.trim()
  if (trimmed === '' || trimmed === USER_DEFAULT_AVATAR_SENTINEL) {
    return null
  }
  if (trimmed.startsWith(BUILTIN_USER_AVATAR_PREFIX)) {
    const id = trimmed.slice(BUILTIN_USER_AVATAR_PREFIX.length) as BuiltinUserAvatarId
    if ((BUILTIN_USER_AVATAR_IDS as readonly string[]).includes(id)) return id
    if (id.startsWith('user-preset-')) return DEFAULT_BUILTIN_USER_AVATAR_ID
    return null
  }
  if (trimmed.startsWith(BUILTIN_ASSISTANT_AVATAR_PREFIX)) {
    return DEFAULT_BUILTIN_USER_AVATAR_ID
  }
  return null
}

export function toBuiltinUserAvatarPath(id: BuiltinUserAvatarId): string {
  return `${BUILTIN_USER_AVATAR_PREFIX}${id}`
}
