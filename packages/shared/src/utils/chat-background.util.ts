import {
  CHAT_BACKGROUND_BLUR_DEFAULT,
  CHAT_BACKGROUND_BLUR_MAX,
  CHAT_BACKGROUND_BLUR_MIN,
  CHAT_BACKGROUND_OVERLAY_DEFAULT,
  CHAT_BACKGROUND_OVERLAY_MAX,
  CHAT_BACKGROUND_OVERLAY_MIN,
  CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_DEFAULT,
  CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MAX,
  CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MIN
} from '../constants/chat-background.constants'

export function normalizeChatBackgroundBlur(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return CHAT_BACKGROUND_BLUR_DEFAULT
  return Math.min(CHAT_BACKGROUND_BLUR_MAX, Math.max(CHAT_BACKGROUND_BLUR_MIN, Math.round(n)))
}

/** 存储值：遮罩不透明度（0 = 无遮罩，越大越暗） */
export function normalizeChatBackgroundOverlayOpacity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return CHAT_BACKGROUND_OVERLAY_DEFAULT
  return Math.min(
    CHAT_BACKGROUND_OVERLAY_MAX,
    Math.max(CHAT_BACKGROUND_OVERLAY_MIN, Math.round(n))
  )
}

/** UI 滑条：遮罩透明度（20% = 最重遮罩，100% = 完全透明） */
export function normalizeChatBackgroundOverlayTransparency(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_DEFAULT
  return Math.min(
    CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MAX,
    Math.max(CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MIN, Math.round(n))
  )
}

export function chatBackgroundOverlayTransparencyFromOpacity(opacity: unknown): number {
  const normalizedOpacity = normalizeChatBackgroundOverlayOpacity(opacity)
  return CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MAX - normalizedOpacity
}

export function chatBackgroundOverlayOpacityFromTransparency(transparency: unknown): number {
  const normalizedTransparency = normalizeChatBackgroundOverlayTransparency(transparency)
  return CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MAX - normalizedTransparency
}

export function chatBackgroundOverlayTransparencyProgress(transparency: unknown): number {
  const normalizedTransparency = normalizeChatBackgroundOverlayTransparency(transparency)
  const span =
    CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MAX - CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MIN
  if (span <= 0) return 0
  return (
    (normalizedTransparency - CHAT_BACKGROUND_OVERLAY_TRANSPARENCY_MIN) / span
  )
}

export function chatBackgroundOverlayAlpha(opacity: unknown): number {
  return normalizeChatBackgroundOverlayOpacity(opacity) / 100
}
