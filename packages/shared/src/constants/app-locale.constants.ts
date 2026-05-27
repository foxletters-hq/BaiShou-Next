import type { SummaryPromptLocale } from '../types/summary-prompt.types'

/** Display order for app UI languages (matches General Settings → Appearance). */
export const APP_UI_LANGUAGE_ORDER = ['zh', 'zh-TW', 'en', 'ja'] as const

export type AppUiLanguage = (typeof APP_UI_LANGUAGE_ORDER)[number] | 'system'

const LANGUAGE_LABELS: Record<SummaryPromptLocale, { labelKey: string; fallback: string }> = {
  zh: { labelKey: 'settings.language_zh', fallback: '简体中文' },
  'zh-TW': { labelKey: 'settings.language_zh_tw', fallback: '繁體中文' },
  en: { labelKey: 'settings.language_en', fallback: 'English' },
  ja: { labelKey: 'settings.language_ja', fallback: '日本語' }
}

/** Language chips for summary prompt editing (same order as General Settings, without “system”). */
export const SUMMARY_PROMPT_LOCALE_OPTIONS = APP_UI_LANGUAGE_ORDER.map((id) => ({
  id,
  ...LANGUAGE_LABELS[id]
}))
