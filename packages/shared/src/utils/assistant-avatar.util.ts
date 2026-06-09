/** 持久化中表示「使用内置默认伙伴头像」的占位值 */
export const ASSISTANT_DEFAULT_AVATAR_SENTINEL = 'default-assistant'

/** 是否使用内置默认伙伴头像（无自定义图片） */
export function isDefaultAssistantAvatarPath(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return true
  return avatarPath.trim() === ASSISTANT_DEFAULT_AVATAR_SENTINEL
}

/** 伙伴头像是否为相对存储路径（需通过 AttachmentManager 解析为本地 URI） */
export function isAssistantAvatarRelativePath(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return false
  return avatarPath.startsWith('avatars/')
}

/** 是否为已上传或自定义伙伴头像（非空且非内置默认占位） */
export function isAssistantCustomAvatar(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return false
  const trimmed = avatarPath.trim()
  return trimmed !== '' && trimmed !== ASSISTANT_DEFAULT_AVATAR_SENTINEL
}

/** 是否可直接作为 Image uri 使用（file://、content:// 等） */
export function isAssistantAvatarDirectUri(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return false
  return /^(file:|content:|https?:|data:)/i.test(avatarPath)
}
