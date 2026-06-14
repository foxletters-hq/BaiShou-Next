import {
  isAssistantAvatarDirectUri,
  isAssistantAvatarRelativePath,
  isDefaultAssistantAvatarPath
} from '@baishou/shared'
import { toFileUri } from '../services/android-external-fs'

/** 从 local:///…/avatars/foo.jpg 或绝对路径中提取 avatars/ 相对键 */
export function extractAvatarsRelativePath(avatarPath: string): string | null {
  const normalized = avatarPath.replace(/\\/g, '/')
  const idx = normalized.toLowerCase().lastIndexOf('avatars/')
  if (idx < 0) return null
  return normalized.slice(idx)
}

/** 将桌面端 local: 协议或相对路径解析结果规范为 RN Image 可读的 file:// URI */
export function normalizeAssistantAvatarDisplayUri(uri: string): string {
  if (/^local:/i.test(uri)) {
    return toFileUri(uri.replace(/^local:/i, ''))
  }
  return uri
}

export function isResolvableAssistantAvatarDirectUri(
  avatarPath: string | null | undefined
): avatarPath is string {
  if (!avatarPath) return false
  if (isAssistantAvatarDirectUri(avatarPath)) return true
  return /^local:/i.test(avatarPath)
}

export async function resolveAssistantAvatarDisplayUri(
  avatarPath: string | undefined,
  resolveRelative: (path: string) => Promise<string>
): Promise<string | undefined> {
  if (isDefaultAssistantAvatarPath(avatarPath)) return undefined

  const relativeFromEmbedded =
    avatarPath && !isAssistantAvatarRelativePath(avatarPath)
      ? extractAvatarsRelativePath(avatarPath)
      : null
  if (relativeFromEmbedded && isAssistantAvatarRelativePath(relativeFromEmbedded)) {
    try {
      return normalizeAssistantAvatarDisplayUri(await resolveRelative(relativeFromEmbedded))
    } catch {
      // fall through to direct-uri handling
    }
  }

  if (avatarPath && isAssistantAvatarRelativePath(avatarPath)) {
    try {
      return normalizeAssistantAvatarDisplayUri(await resolveRelative(avatarPath))
    } catch {
      return undefined
    }
  }

  if (avatarPath && isResolvableAssistantAvatarDirectUri(avatarPath)) {
    return normalizeAssistantAvatarDisplayUri(avatarPath)
  }

  return undefined
}
