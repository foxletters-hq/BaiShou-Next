import type { TextStyle, ViewStyle } from 'react-native'
import { lightColors } from '../theme/light'

export type ChatOverBackgroundTone = 'light' | 'dark' | boolean

/** 纯白（用于暗色背景区域反色） */
export const CHAT_OVER_BG_WHITE = lightColors.textOnPrimary
/** 纯黑（用于亮色背景区域反色） */
export const CHAT_OVER_BG_BLACK = '#000000'

/**
 * 叠在自定义聊天背景上时的元数据样式（发送者姓名、时间、Token消耗、操作按钮等）
 * 仅使用纯黑（#000000）与纯白（#ffffff）二值反色，无任何阴影勾勒与彩色杂色：
 * - 背景偏暗（'dark' / true）时使用纯白 #ffffff
 * - 背景偏亮（'light'）时使用纯黑 #000000
 */
export const chatOverBackgroundMetaTextStyle: TextStyle = {
  color: CHAT_OVER_BG_WHITE
}

export const chatOverBackgroundMetaLightTextStyle: TextStyle = {
  color: CHAT_OVER_BG_BLACK
}

export const chatOverBackgroundMetaIconStyle: ViewStyle = {}

export const chatOverBackgroundMetaIconColor = CHAT_OVER_BG_WHITE
export const chatOverBackgroundMetaLightIconColor = CHAT_OVER_BG_BLACK

export function getChatOverBackgroundMetaTextStyle(
  tone?: ChatOverBackgroundTone | null
): TextStyle | null {
  if (!tone) return null
  return tone === 'light' ? chatOverBackgroundMetaLightTextStyle : chatOverBackgroundMetaTextStyle
}

export function getChatOverBackgroundMetaIconColor(
  tone?: ChatOverBackgroundTone | null
): string | undefined {
  if (!tone) return undefined
  return tone === 'light' ? chatOverBackgroundMetaLightIconColor : chatOverBackgroundMetaIconColor
}

/**
 * 聊天气泡叠在自定义背景上时的半透明磨砂质感
 * 与 InputBar composerShell 保持统一的不透明度、边框与投影
 */
export function getChatBubbleOverBackgroundStyle(
  hasChatBackground: boolean,
  isDark: boolean,
  colors: { bgSurface: string }
): ViewStyle {
  if (hasChatBackground) {
    return {
      backgroundColor: isDark ? 'rgba(32, 33, 37, 0.85)' : 'rgba(255, 255, 255, 0.88)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.10)',
      borderWidth: 1
    }
  }
  return {
    backgroundColor: colors.bgSurface,
    borderWidth: 0,
    borderColor: 'transparent'
  }
}
