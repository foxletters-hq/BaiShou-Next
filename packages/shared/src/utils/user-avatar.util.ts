/** 持久化中表示「使用应用默认头像」的占位值 */
export const USER_DEFAULT_AVATAR_SENTINEL = 'default'

/** 是否为用户自定义头像（非空且非默认占位） */
export function isCustomUserAvatar(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return false
  const trimmed = avatarPath.trim()
  return trimmed !== '' && trimmed !== USER_DEFAULT_AVATAR_SENTINEL
}
