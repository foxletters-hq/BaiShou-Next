import {
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID,
  isAssistantAvatarDirectUri,
  isAssistantAvatarRelativePath,
  isDefaultAssistantAvatarPath,
  parseBuiltinAssistantAvatarId
} from '@baishou/shared'
import { DESKTOP_BUILTIN_ASSISTANT_AVATAR_URLS } from './builtin-assistant-avatar.sources'

/** 解析伙伴头像展示 URL（内置预设 / 本地上传 / secure-file） */
export function resolveDesktopAssistantAvatarSrc(avatarPath?: string | null): string {
  const builtinId = parseBuiltinAssistantAvatarId(avatarPath)
  if (builtinId) {
    return DESKTOP_BUILTIN_ASSISTANT_AVATAR_URLS[builtinId]
  }
  if (!avatarPath || isDefaultAssistantAvatarPath(avatarPath)) {
    return DESKTOP_BUILTIN_ASSISTANT_AVATAR_URLS[DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID]
  }
  if (
    avatarPath.startsWith('data:') ||
    avatarPath.startsWith('http://') ||
    avatarPath.startsWith('https://') ||
    avatarPath.startsWith('blob:')
  ) {
    return avatarPath
  }
  if (
    avatarPath.startsWith('secure-file://') ||
    avatarPath.startsWith('local://') ||
    avatarPath.startsWith('file://')
  ) {
    return avatarPath
  }
  if (isAssistantAvatarRelativePath(avatarPath) || isAssistantAvatarDirectUri(avatarPath)) {
    const normalized = avatarPath.replace(/\\/g, '/')
    const isDesktopElectron =
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as { window?: { electron?: unknown } }).window !== 'undefined' &&
      Boolean((globalThis as { window?: { electron?: unknown } }).window?.electron)
    if (isDesktopElectron) {
      return normalized.startsWith('local://') ? normalized : `local://${normalized}`
    }
    return normalized.startsWith('secure-file://') ? normalized : `secure-file://${normalized}`
  }
  return DESKTOP_BUILTIN_ASSISTANT_AVATAR_URLS[DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID]
}

export function resolveBuiltinAssistantAvatarPreviewSrc(
  avatarPath?: string | null
): string | undefined {
  const builtinId = parseBuiltinAssistantAvatarId(avatarPath)
  if (builtinId) return DESKTOP_BUILTIN_ASSISTANT_AVATAR_URLS[builtinId]
  if (!avatarPath || isDefaultAssistantAvatarPath(avatarPath)) return undefined
  if (avatarPath.startsWith('data:')) return avatarPath
  return resolveDesktopAssistantAvatarSrc(avatarPath)
}
