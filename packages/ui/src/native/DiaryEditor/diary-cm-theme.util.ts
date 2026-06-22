import type { DiaryCmTheme } from '../../shared/diary-codemirror/types'
import type { useNativeTheme } from '../theme'

/** 将 RN 主题色映射为 WebView CM 可用的 CSS 变量源（P-1） */
export function buildDiaryCmThemeFromNative(
  isDark: boolean,
  colors: ReturnType<typeof useNativeTheme>['colors']
): DiaryCmTheme {
  return {
    isDark,
    textPrimary: colors.textPrimary,
    textSecondary: colors.textSecondary,
    bgEditor: colors.bgSurface,
    borderColor: colors.borderSubtle,
    primary: colors.primary,
    tagColors: [colors.accentBlue, colors.accentGreen, colors.warning, colors.accentPurple]
  }
}
