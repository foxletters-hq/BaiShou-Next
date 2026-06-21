/** 聊天背景模糊半径（px） */
export const CHAT_BACKGROUND_BLUR_MIN = 0
export const CHAT_BACKGROUND_BLUR_MAX = 24
export const CHAT_BACKGROUND_BLUR_DEFAULT = 0

/** 聊天背景黑色遮罩不透明度（存储值 0–80%，0 = 无遮罩） */
export const CHAT_BACKGROUND_OVERLAY_MIN = 0
export const CHAT_BACKGROUND_OVERLAY_MAX = 80
export const CHAT_BACKGROUND_OVERLAY_DEFAULT = 0

/** UI 滑条：遮罩透明度展示范围（20% = 最重遮罩，100% = 完全透明） */
export const CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MIN = 20
export const CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MAX = 100
export const CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_DEFAULT =
  CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MAX

/** 移动端聊天背景导入：最长边上限（保留 3:4 比例，避免超大图无法缩放展示） */
export const CHAT_BACKGROUND_IMPORT_MAX_DIMENSION = 2048

/** 移动端聊天背景选图裁剪比例（宽:高） */
export const CHAT_BACKGROUND_CROP_ASPECT = [3, 4] as const
