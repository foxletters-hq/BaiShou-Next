import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import i18n, { ensureUiLocaleLoaded } from '../i18n'

const here = dirname(fileURLToPath(import.meta.url))

describe('ensureUiLocaleLoaded', () => {
  beforeAll(async () => {
    if (!i18n.isInitialized) {
      await i18n.init()
    }
  })

  it('should keep zh available without waiting for another locale loader', () => {
    expect(i18n.hasResourceBundle('zh', 'translation')).toBe(true)
  })

  it('should add ja when changeLanguage waits for the locale loader', async () => {
    await i18n.changeLanguage('ja')
    expect(i18n.hasResourceBundle('ja', 'translation')).toBe(true)
    expect(i18n.language).toMatch(/^ja/)
    await i18n.changeLanguage('zh')
  })

  it('should load zh-TW through ensureUiLocaleLoaded without changing UI language', async () => {
    const previous = i18n.language
    await ensureUiLocaleLoaded('zh-TW')
    expect(i18n.hasResourceBundle('zh-TW', 'translation')).toBe(true)
    expect(i18n.language).toBe(previous)
  })
})

describe('ui locale source chrome', () => {
  it('should not statically import extra locale json in i18n.ts', () => {
    const src = readFileSync(join(here, '../i18n.ts'), 'utf8')
    expect(src).toMatch(/import zh from '\.\/locales\/zh'/)
    expect(src).not.toMatch(/import en from '\.\/locales\/en'/)
    expect(src).not.toMatch(/import ja from '\.\/locales\/ja'/)
    expect(src).not.toMatch(/import zh_TW from '\.\/locales\/zh-TW'/)
    expect(src).toContain("import('./locales/en')")
    expect(src).toContain("import('./locales/ja')")
    expect(src).toContain("import('./locales/zh-TW')")
  })
})
