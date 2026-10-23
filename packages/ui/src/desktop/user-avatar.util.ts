import appBrandIcon from '@baishou/shared/assets/images/icon.png'
import {
  isCustomUserAvatar,
  isBuiltinUserAvatarPath,
  parseBuiltinUserAvatarId
} from '@baishou/shared'
import { DESKTOP_BUILTIN_USER_AVATAR_URLS } from './builtin-user-avatar.sources'

export { isCustomUserAvatar, isBuiltinUserAvatarPath }

export const WEB_APP_BRAND_ICON_SRC = appBrandIcon

/** Desktop / Electron 渲染层：解析用户头像展示 URL */
export function resolveDesktopUserAvatarSrc(avatarPath?: string | null): string {
  if (isBuiltinUserAvatarPath(avatarPath)) {
    const id = parseBuiltinUserAvatarId(avatarPath)
    if (id && DESKTOP_BUILTIN_USER_AVATAR_URLS[id]) {
      return DESKTOP_BUILTIN_USER_AVATAR_URLS[id]
    }
    return WEB_APP_BRAND_ICON_SRC
  }
  if (isCustomUserAvatar(avatarPath)) {
    if (
      avatarPath!.startsWith('http') ||
      avatarPath!.startsWith('data:') ||
      avatarPath!.startsWith('local://') ||
      avatarPath!.startsWith('file://')
    ) {
      return avatarPath!
    }
    return `local://${avatarPath}`
  }
  return WEB_APP_BRAND_ICON_SRC
}
