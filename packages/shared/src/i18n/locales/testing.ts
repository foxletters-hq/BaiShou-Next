import { UI_LOCALE_CATALOGS, type UiLocaleCode } from './all-locales'

export const TEST_LOCALE_CODES = ['zh', 'zh-TW', 'en', 'ja'] as const
export type TestLocaleCode = (typeof TEST_LOCALE_CODES)[number]

/**
 * 规范化语言目录名：
 * 兼容传入旧版文件名（如 'zh.i18n.json'、'zh_TW.i18n.json'）或标准语言码（如 'zh-TW'、'zh_TW'）。
 */
export function normalizeLocaleDir(input: string): UiLocaleCode {
  const stripped = input.replace(/\.i18n\.json$/, '')
  if (stripped === 'zh_TW' || stripped === 'zh-TW') {
    return 'zh-TW'
  }
  return stripped as UiLocaleCode
}

/**
 * 读取某个语言的完整目录对象（纯内存，零文件系统 I/O，安全跨平台）。
 */
export function readLocaleCatalog(_i18nDir: string, locale: string): Record<string, any> {
  const code = normalizeLocaleDir(locale)
  return UI_LOCALE_CATALOGS[code] as Record<string, any>
}

/**
 * 读取某个语言下所有 JSON 片段，合并并格式化为完整的 JSON 字符串。
 * 供现有以 `expect(jsonString).toContain('"key"')` 为主体的测试无缝断言。
 */
export function readLocaleMergedJsonString(_i18nDir: string, locale: string): string {
  const catalog = readLocaleCatalog(_i18nDir, locale)
  return JSON.stringify(catalog, null, 2)
}
