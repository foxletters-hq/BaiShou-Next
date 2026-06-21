import appBrandIcon from '@baishou/shared/assets/images/icon.png'
import { isCustomUserAvatar } from '@baishou/shared'

export { isCustomUserAvatar }

export const WEB_APP_BRAND_ICON_SRC = appBrandIcon

/** Web / Electron 渲染层：解析用户头像展示 URL */
export function resolveWebUserAvatarSrc(avatarPath?: string | null): string {
  if (isCustomUserAvatar(avatarPath)) return avatarPath!
  return WEB_APP_BRAND_ICON_SRC
}
