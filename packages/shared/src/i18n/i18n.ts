import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { resolveAppLanguage } from '../utils/main-i18n-language'
import zh from './zh.i18n.json'

export const defaultNS = 'translation'

const localeLoaders: Record<string, () => Promise<unknown>> = {
  en: () => import('./en.i18n.json'),
  ja: () => import('./ja.i18n.json'),
  'zh-TW': () => import('./zh_TW.i18n.json')
}

const loadedLocales = new Set<string>(['zh'])
const inflightLocales = new Map<string, Promise<void>>()

function readCatalog(mod: unknown): object {
  if (mod && typeof mod === 'object' && 'default' in mod) {
    const catalog = (mod as { default: unknown }).default
    if (catalog && typeof catalog === 'object') return catalog
  }
  if (mod && typeof mod === 'object') return mod
  return {}
}

/** 按语言加载 UI 目录；默认语言 zh 已打进初始包。 */
export async function ensureUiLocaleLoaded(lng: string): Promise<void> {
  const code = resolveAppLanguage(lng)
  if (loadedLocales.has(code)) return
  const loader = localeLoaders[code]
  if (!loader) return

  const pending = inflightLocales.get(code)
  if (pending) {
    await pending
    return
  }

  const load = loader()
    .then((mod) => {
      i18n.addResourceBundle(code, defaultNS, readCatalog(mod), true, true)
      loadedLocales.add(code)
    })
    .finally(() => {
      inflightLocales.delete(code)
    })
  inflightLocales.set(code, load)
  await load
}

export const resources = {
  zh: { translation: zh }
} as const

i18n.use(initReactI18next).init({
  resources,
  lng: 'zh',
  fallbackLng: 'en',
  ns: [defaultNS],
  defaultNS,
  partialBundledLanguages: true,
  interpolation: {
    escapeValue: false // React protects against XSS
  }
})

const originalChangeLanguage = i18n.changeLanguage.bind(i18n)
i18n.changeLanguage = (async (lng, callback) => {
  if (lng) await ensureUiLocaleLoaded(lng)
  return originalChangeLanguage(lng, callback)
}) as typeof i18n.changeLanguage

export default i18n
