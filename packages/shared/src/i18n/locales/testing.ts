import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const TEST_LOCALE_CODES = ['zh', 'zh-TW', 'en', 'ja'] as const
export type TestLocaleCode = (typeof TEST_LOCALE_CODES)[number]

/**
 * 规范化语言目录名：
 * 兼容传入旧版文件名（如 'zh.i18n.json'、'zh_TW.i18n.json'）或标准语言码（如 'zh-TW'、'zh_TW'）。
 */
export function normalizeLocaleDir(input: string): string {
  const stripped = input.replace(/\.i18n\.json$/, '')
  if (stripped === 'zh_TW' || stripped === 'zh-TW') {
    return 'zh-TW'
  }
  return stripped
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const existing = target[key]
      if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
        target[key] = {}
      }
      deepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      target[key] = value
    }
  }
}

/**
 * 读取某个语言下所有 JSON 片段并深合并为一个完整对象。
 */
export function readLocaleCatalog(i18nDir: string, locale: string): Record<string, any> {
  const dirName = normalizeLocaleDir(locale)
  const targetDir = join(i18nDir, 'locales', dirName)
  const files = readdirSync(targetDir).filter((file) => file.endsWith('.json'))
  const merged: Record<string, any> = {}
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(targetDir, file), 'utf8'))
    deepMerge(merged, raw)
  }
  return merged
}

/**
 * 读取某个语言下所有 JSON 片段，合并并格式化为完整的 JSON 字符串。
 * 供现有以 `expect(jsonString).toContain('"key"')` 为主体的测试无缝断言。
 */
export function readLocaleMergedJsonString(i18nDir: string, locale: string): string {
  const catalog = readLocaleCatalog(i18nDir, locale)
  return JSON.stringify(catalog, null, 2)
}
