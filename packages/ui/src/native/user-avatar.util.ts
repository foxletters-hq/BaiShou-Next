import type { ImageSourcePropType } from 'react-native'
import { isCustomUserAvatar } from '@baishou/shared'

export { isCustomUserAvatar }

export const NATIVE_APP_BRAND_ICON: ImageSourcePropType = require('@baishou/shared/assets/images/icon.png')

/** React Native：解析用户头像 Image source */
export function resolveNativeUserAvatarSource(
  avatarPath?: string | null,
  resolvedUri?: string | null
): ImageSourcePropType {
  if (resolvedUri) return { uri: resolvedUri }
  if (isCustomUserAvatar(avatarPath)) return { uri: avatarPath! }
  return NATIVE_APP_BRAND_ICON
}
