import i18n from 'i18next'
import { beforeEach, describe, expect, it } from 'vitest'
import { resolveAppLanguage, translateMain } from '../main-i18n.util'

describe('resolveAppLanguage', () => {
  it('maps zh variants and system to zh / zh-TW', () => {
    expect(resolveAppLanguage(undefined)).toBe('zh')
    expect(resolveAppLanguage('system')).toBe('zh')
    expect(resolveAppLanguage('zh-CN')).toBe('zh')
    expect(resolveAppLanguage('zh-TW')).toBe('zh-TW')
    expect(resolveAppLanguage('zh-HK')).toBe('zh-TW')
    expect(resolveAppLanguage('en-US')).toBe('en')
    expect(resolveAppLanguage('ja')).toBe('ja')
  })
})

describe('translateMain', () => {
  beforeEach(async () => {
    if (!i18n.isInitialized) {
      await i18n.init({
        lng: 'zh',
        fallbackLng: 'en',
        resources: {
          zh: { translation: { 'test.hello': '你好' } },
          en: { translation: { 'test.hello': 'Hello' } }
        },
        interpolation: { escapeValue: false }
      })
    } else {
      await i18n.changeLanguage('zh')
    }
  })

  it('does not mutate the global i18next language', async () => {
    expect(i18n.language).toBe('zh')
    translateMain('en', 'agent.tools.web_search_not_enabled', 'Web search not enabled')
    expect(i18n.language).toMatch(/^zh/)
    expect(i18n.t('test.hello')).toBe('你好')
  })

  it('returns localized string for explicit locale without changing UI lng', () => {
    const zh = translateMain('zh', 'agent.tools.web_search_not_enabled', 'fallback-zh')
    const en = translateMain('en', 'agent.tools.web_search_not_enabled', 'fallback-en')
    expect(typeof zh).toBe('string')
    expect(typeof en).toBe('string')
    expect(zh.length).toBeGreaterThan(0)
    expect(en.length).toBeGreaterThan(0)
    expect(i18n.language).toMatch(/^zh/)
  })
})
