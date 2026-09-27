import {
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID,
  getBuiltinAssistantAvatarAssetRelativePath
} from './builtin-assistant-avatars.constants'

/**
 * 应用品牌默认图标相对路径（移动端 app.json、应用内展示等）。
 * 源图：packages/shared/assets/images/app-brand-icon-source.png → 执行 pnpm sync --only=icons 生成各端产物。
 */
export const APP_BRAND_ICON_PATH = 'assets/images/icon.png'

/** 品牌图标源文件（换图后执行 pnpm sync --only=icons） */
export const APP_BRAND_ICON_SOURCE_PATH = 'assets/images/app-brand-icon-source.png'

/** 关于页横幅（桌面 / 移动端共用，源文件在 packages/shared/assets/images/） */
export const APP_BRAND_BANNER_PATH = 'assets/images/Next-1.0.0-banner.jpg'

/** 内置默认伙伴头像（与 DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID 同一张） */
export const DEFAULT_ASSISTANT_AVATAR_PATH = getBuiltinAssistantAvatarAssetRelativePath(
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID
)
