import type { ImageSourcePropType } from 'react-native'
import {
  isAssistantAvatarDirectUri,
  isAssistantAvatarRelativePath,
  isAssistantCustomAvatar,
  isDefaultAssistantAvatarPath
} from '@baishou/shared'

export const NATIVE_DEFAULT_ASSISTANT_AVATAR: ImageSourcePropType = require('@baishou/shared/assets/images/default-assistant-avatar.jpg')

/**
 * 解析伙伴头像 Image source。
 * @param avatarPath 已解析的 file:// URI，或相对路径（需调用方先 resolve）
 * @param resolvedUri 当 avatarPath 为 avatars/ 相对路径时，传入 resolve 后的 URI
 */
export function resolveNativeAssistantAvatarSource(
  avatarPath?: string | null,
  resolvedUri?: string | null
): ImageSourcePropType {
  if (resolvedUri) {
    return { uri: resolvedUri }
  }
  if (avatarPath && isAssistantAvatarDirectUri(avatarPath)) {
    return { uri: avatarPath }
  }
  if (isAssistantAvatarRelativePath(avatarPath)) {
    return NATIVE_DEFAULT_ASSISTANT_AVATAR
  }
  if (!isAssistantCustomAvatar(avatarPath)) {
    return NATIVE_DEFAULT_ASSISTANT_AVATAR
  }
  return NATIVE_DEFAULT_ASSISTANT_AVATAR
}

/** 仅当用户主动选择 emoji 且没有图片头像时显示 emoji */
export function shouldShowAssistantEmoji(
  avatarPath?: string | null,
  resolvedUri?: string | null,
  emoji?: string | null
): boolean {
  if (!emoji) return false
  if (resolvedUri) return false
  if (avatarPath && isAssistantAvatarDirectUri(avatarPath)) return false
  if (avatarPath?.startsWith('avatars/')) return false
  if (isAssistantCustomAvatar(avatarPath)) return false
  if (isDefaultAssistantAvatarPath(avatarPath)) return false
  return true
}
