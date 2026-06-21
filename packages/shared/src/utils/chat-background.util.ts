import {
  CHAT_BACKGROUND_BLUR_DEFAULT,
  CHAT_BACKGROUND_BLUR_MAX,
  CHAT_BACKGROUND_BLUR_MIN,
  CHAT_BACKGROUND_OVERLAY_DEFAULT,
  CHAT_BACKGROUND_OVERLAY_MAX,
  CHAT_BACKGROUND_OVERLAY_MIN
} from '../constants/chat-background.constants'

export function normalizeChatBackgroundBlur(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return CHAT_BACKGROUND_BLUR_DEFAULT
  return Math.min(CHAT_BACKGROUND_BLUR_MAX, Math.max(CHAT_BACKGROUND_BLUR_MIN, Math.round(n)))
}

export function normalizeChatBackgroundOverlayOpacity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return CHAT_BACKGROUND_OVERLAY_DEFAULT
  return Math.min(
    CHAT_BACKGROUND_OVERLAY_MAX,
    Math.max(CHAT_BACKGROUND_OVERLAY_MIN, Math.round(n))
  )
}

export function chatBackgroundOverlayAlpha(percent: number): number {
  return normalizeChatBackgroundOverlayOpacity(percent) / 100
}
