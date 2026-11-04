import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UI_LOCALE_CATALOGS, type UiLocaleCode } from '../locales/all-locales'

const LOCALES_ROOT = join(__dirname, '../locales')
const EXPECTED_LOCALES: UiLocaleCode[] = ['zh', 'en', 'ja', 'zh-TW']

describe('i18n locales integrity and max-lines boundary', () => {
  it('should ensure all four locale directories have the exact same list of JSON fragments', () => {
    const fileLists: Record<string, string[]> = {}
    for (const locale of EXPECTED_LOCALES) {
      const files = readdirSync(join(LOCALES_ROOT, locale))
        .filter((f) => f.endsWith('.json'))
        .sort()
      fileLists[locale] = files
    }

    const baseline = fileLists['zh']!
    expect(baseline.length).toBeGreaterThanOrEqual(15)

    for (const locale of EXPECTED_LOCALES) {
      expect(fileLists[locale], `${locale} fragment list does not match zh`).toEqual(baseline)
    }
  })

  it('should strictly enforce that every single i18n file (JSON and TS) is <= 500 lines', () => {
    for (const locale of EXPECTED_LOCALES) {
      const dir = join(LOCALES_ROOT, locale)
      const allFiles = readdirSync(dir)
      for (const file of allFiles) {
        const fullPath = join(dir, file)
        const content = readFileSync(fullPath, 'utf8')
        const lineCount = content.split('\n').length
        expect(
          lineCount,
          `File ${locale}/${file} exceeds 500 lines limit: actual ${lineCount}`
        ).toBeLessThanOrEqual(500)
      }
    }
  })

  it('should successfully build all four locale catalogs without leaf key collisions', () => {
    for (const locale of EXPECTED_LOCALES) {
      const catalog = UI_LOCALE_CATALOGS[locale]
      expect(catalog).toBeDefined()
      expect(typeof catalog).toBe('object')
      expect(Object.keys(catalog).length).toBeGreaterThanOrEqual(50)
    }
  })

  it('should verify parity of top-level namespaces between zh and other locales', () => {
    const zhKeys = Object.keys(UI_LOCALE_CATALOGS.zh).sort()
    for (const locale of EXPECTED_LOCALES) {
      const keys = Object.keys(UI_LOCALE_CATALOGS[locale]).sort()
      expect(keys, `${locale} top-level namespaces differ from zh`).toEqual(zhKeys)
    }
  })
})
