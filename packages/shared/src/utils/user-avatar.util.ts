import {
  USER_DEFAULT_AVATAR_SENTINEL,
  BUILTIN_USER_AVATAR_PREFIX,
  BUILTIN_USER_AVATAR_IDS,
  type BuiltinUserAvatarId,
  DEFAULT_BUILTIN_USER_AVATAR_ID,
  DEFAULT_BUILTIN_USER_AVATAR_PATH,
  isBuiltinUserAvatarPath,
  parseBuiltinUserAvatarId,
  toBuiltinUserAvatarPath
} from '../constants/builtin-user-avatars.constants'

export {
  USER_DEFAULT_AVATAR_SENTINEL,
  BUILTIN_USER_AVATAR_PREFIX,
  BUILTIN_USER_AVATAR_IDS,
  type BuiltinUserAvatarId,
  DEFAULT_BUILTIN_USER_AVATAR_ID,
  DEFAULT_BUILTIN_USER_AVATAR_PATH,
  isBuiltinUserAvatarPath,
  parseBuiltinUserAvatarId,
  toBuiltinUserAvatarPath
}

/** 是否为用户自定义上传的头像（非空且非默认/内置预设） */
export function isCustomUserAvatar(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return false
  const trimmed = avatarPath.trim()
  if (trimmed === '' || trimmed === USER_DEFAULT_AVATAR_SENTINEL) return false
  if (isBuiltinUserAvatarPath(trimmed)) return false
  return true
}
