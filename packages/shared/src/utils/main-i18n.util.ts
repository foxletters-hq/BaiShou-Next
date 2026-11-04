import { createInstance, type i18n as I18nInstance } from 'i18next'

import { UI_LOCALE_CATALOGS } from '../i18n/locales/all-locales'
import { resolveAppLanguage } from './main-i18n-language'

export { resolveAppLanguage }

/** 独立实例：绝不能碰全局 i18next 单例，否则会把 App UI 语言改成 init 的 lng */
let mainI18n: I18nInstance | null = null

function ensureMainI18n(): I18nInstance {
  if (mainI18n) return mainI18n

  const instance = createInstance()
  instance.init({
    resources: {
      en: { translation: UI_LOCALE_CATALOGS.en },
      ja: { translation: UI_LOCALE_CATALOGS.ja },
      zh: { translation: UI_LOCALE_CATALOGS.zh },
      'zh-TW': { translation: UI_LOCALE_CATALOGS['zh-TW'] }
    },
    lng: 'zh',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    initImmediate: false
  } as any)
  mainI18n = instance
  return instance
}

/** Translate a key in the main process using the user's app language. */
export function translateMain(
  locale: string | undefined,
  key: string,
  defaultValue?: string
): string {
  const instance = ensureMainI18n()
  const lng = resolveAppLanguage(locale)
  const value = instance.t(key, { lng, defaultValue })
  return typeof value === 'string' ? value : (defaultValue ?? key)
}
