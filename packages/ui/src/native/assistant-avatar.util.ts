import type { ImageSourcePropType } from 'react-native'
import {
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID,
  isAssistantAvatarDirectUri,
  isAssistantAvatarRelativePath,
  isDefaultAssistantAvatarPath,
  parseBuiltinAssistantAvatarId
} from '@baishou/shared'
import { NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES } from './builtin-assistant-avatar.sources'

export function resolveNativeBuiltinAssistantAvatarSource(
  avatarPath?: string | null
): ImageSourcePropType {
  const id =
    parseBuiltinAssistantAvatarId(avatarPath) ??
    (isDefaultAssistantAvatarPath(avatarPath) || !avatarPath
      ? DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID
      : null)
  if (id) {
    return NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES[id]
  }
  return NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES[DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID]
}

/**
 * 解析伙伴头像 Image source。
 * @param avatarPath 内置路径、已解析 file://，或 avatars/ 相对路径
 * @param resolvedUri 相对路径经 AttachmentManager 解析后的 URI
 */
export function resolveNativeAssistantAvatarSource(
  avatarPath?: string | null,
  resolvedUri?: string | null
): ImageSourcePropType {
  if (resolvedUri) {
    return { uri: resolvedUri }
  }
  if (isDefaultAssistantAvatarPath(avatarPath) || parseBuiltinAssistantAvatarId(avatarPath)) {
    return resolveNativeBuiltinAssistantAvatarSource(avatarPath)
  }
  if (avatarPath && isAssistantAvatarDirectUri(avatarPath)) {
    return { uri: avatarPath }
  }
  if (avatarPath && /^local:/i.test(avatarPath)) {
    const path = avatarPath.replace(/^local:/i, '')
    const uri = path.startsWith('/') ? `file://${path}` : `file:///${path}`
    return { uri }
  }
  if (isAssistantAvatarRelativePath(avatarPath)) {
    return resolveNativeBuiltinAssistantAvatarSource(null)
  }
  return resolveNativeBuiltinAssistantAvatarSource(null)
}

/** @deprecated 伙伴头像不再使用 emoji */
export function shouldShowAssistantEmoji(
  _avatarPath?: string | null,
  _resolvedUri?: string | null,
  _emoji?: string | null
): boolean {
  return false
}
