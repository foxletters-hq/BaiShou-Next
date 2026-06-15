import { APP_UI_LANGUAGE_ORDER } from '../constants/app-locale.constants'
import {
  resolveCompressionPromptLocale,
  type CompressionPromptLocale
} from '../constants/compression-prompt.defaults'

export type ResolvedAppUiLanguage = CompressionPromptLocale

export function isAppUiLanguage(value: string): value is ResolvedAppUiLanguage {
  return (APP_UI_LANGUAGE_ORDER as readonly string[]).includes(value)
}

/** 从系统 / 存储原始字符串解析为 App UI 语言；`system` 或无法识别时返回 null */
export function normalizeAppUiLanguage(raw?: string | null): ResolvedAppUiLanguage | null {
  if (!raw || raw.trim() === '' || raw === 'system') return null
  const resolved = resolveCompressionPromptLocale(raw)
  return isAppUiLanguage(resolved) ? resolved : null
}

/** 从设备 locale 字符串（如 `zh-TW`、`en-US`）解析 App UI 语言 */
export function resolveAppUiLanguageFromSystemLocale(
  systemLocale?: string | null
): ResolvedAppUiLanguage {
  const resolved = resolveCompressionPromptLocale(systemLocale || 'zh')
  return isAppUiLanguage(resolved) ? resolved : 'zh'
}

/**
 * 解析创建 Latte / 加载 UI 时应使用的语言。
 * 未完成引导且用户尚未选择语言时返回 null（应延迟创建 Latte）。
 */
export function resolveBootstrapUiLocale(input: {
  savedLanguage?: string | null
  onboardingLanguage?: string | null
  systemLocale?: string | null
  hasCompletedOnboarding?: boolean
}): ResolvedAppUiLanguage | null {
  const explicit = normalizeAppUiLanguage(input.savedLanguage)
  if (explicit) return explicit

  const fromOnboarding = normalizeAppUiLanguage(input.onboardingLanguage)
  if (fromOnboarding) return fromOnboarding

  if (input.hasCompletedOnboarding) {
    return resolveAppUiLanguageFromSystemLocale(input.systemLocale)
  }

  return null
}
