import type { ImageSourcePropType } from 'react-native'
import appBrandIcon from '@baishou/shared/assets/images/icon.png'
import {
  isAssistantAvatarDirectUri,
  isCustomUserAvatar,
  isBuiltinUserAvatarPath,
  parseBuiltinUserAvatarId
} from '@baishou/shared'
import { NATIVE_BUILTIN_USER_AVATAR_SOURCES } from './builtin-user-avatar.sources'

export { isCustomUserAvatar, isBuiltinUserAvatarPath }

export const NATIVE_APP_BRAND_ICON: ImageSourcePropType = appBrandIcon as ImageSourcePropType

/** React Native：解析用户头像 Image source */
export function resolveNativeUserAvatarSource(
  avatarPath?: string | null,
  resolvedUri?: string | null
): ImageSourcePropType {
  if (isBuiltinUserAvatarPath(avatarPath)) {
    const id = parseBuiltinUserAvatarId(avatarPath)
    if (id && NATIVE_BUILTIN_USER_AVATAR_SOURCES[id]) {
      return NATIVE_BUILTIN_USER_AVATAR_SOURCES[id]
    }
    return NATIVE_APP_BRAND_ICON
  }
  if (resolvedUri) return { uri: resolvedUri }
  if (isCustomUserAvatar(avatarPath) && isAssistantAvatarDirectUri(avatarPath)) {
    return { uri: avatarPath! }
  }
  return NATIVE_APP_BRAND_ICON
}
