import {
  isAssistantAvatarDirectUri,
  isAssistantAvatarRelativePath,
  isDefaultAssistantAvatarPath
} from '@baishou/shared'
import { toFileUri } from '../services/android-external-fs'

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
  if (avatarPath && isResolvableAssistantAvatarDirectUri(avatarPath)) {
    return normalizeAssistantAvatarDisplayUri(avatarPath)
  }
  if (avatarPath && isAssistantAvatarRelativePath(avatarPath)) {
    try {
      return normalizeAssistantAvatarDisplayUri(await resolveRelative(avatarPath))
    } catch {
      return undefined
    }
  }
  return undefined
}
