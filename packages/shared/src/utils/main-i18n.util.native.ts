import i18n from '../i18n/i18n'
import { resolveAppLanguage } from './main-i18n-language'

export { resolveAppLanguage }

/** 移动端走全局 UI 目录；用 `{ lng }` 取值，不改当前界面语言。 */
export function translateMain(
  locale: string | undefined,
  key: string,
  defaultValue?: string
): string {
  const lng = resolveAppLanguage(locale)
  const value = i18n.t(key, { lng, defaultValue })
  return typeof value === 'string' ? value : (defaultValue ?? key)
}
