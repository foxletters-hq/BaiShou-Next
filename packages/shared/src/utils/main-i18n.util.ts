import i18n from 'i18next'

import en from '../i18n/en.i18n.json'
import ja from '../i18n/ja.i18n.json'
import zh from '../i18n/zh.i18n.json'
import zh_TW from '../i18n/zh_TW.i18n.json'

let initialized = false

/** Map UI / store locale to i18next language code. */
export function resolveAppLanguage(locale?: string): string {
  const normalized = (locale || 'zh').toLowerCase().replace('_', '-')
  if (normalized === 'system' || normalized === '') {
    return 'zh'
  }
  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk')) {
    return 'zh-TW'
  }
  if (normalized.startsWith('zh')) return 'zh'
  if (normalized.startsWith('ja')) return 'ja'
  if (normalized.startsWith('en')) return 'en'
  return 'en'
}

function ensureMainI18n(): void {
  if (initialized) return
  i18n.init({
    resources: {
      en: { translation: en },
      ja: { translation: ja },
      zh: { translation: zh },
      'zh-TW': { translation: zh_TW }
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    initImmediate: false
  } as any)
  initialized = true
}

/** Translate a key in the main process using the user's app language. */
export function translateMain(
  locale: string | undefined,
  key: string,
  defaultValue?: string
): string {
  ensureMainI18n()
  const lng = resolveAppLanguage(locale)
  const value = i18n.t(key, { lng, defaultValue })
  return typeof value === 'string' ? value : (defaultValue ?? key)
}
