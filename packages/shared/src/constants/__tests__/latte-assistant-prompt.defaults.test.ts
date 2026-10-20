import { describe, it, expect } from 'vitest'
import {
  isFactoryLatteAssistantSystemPrompt,
  isLegacyDefaultAssistantSystemPrompt,
  getDefaultLatteAssistantSystemPrompt
} from '../latte-assistant-prompt.defaults'
import {
  normalizeAppUiLanguage,
  resolveAppUiLanguageFromSystemLocale,
  resolveBootstrapUiLocale
} from '../../utils/app-ui-locale.util'

describe('app-ui-locale.util', () => {
  it('resolves zh-TW from system locale', () => {
    expect(resolveAppUiLanguageFromSystemLocale('zh-TW')).toBe('zh-TW')
    expect(resolveAppUiLanguageFromSystemLocale('zh-HK')).toBe('zh-TW')
  })

  it('defers bootstrap locale until onboarding language is chosen', () => {
    expect(
      resolveBootstrapUiLocale({
        savedLanguage: 'system',
        systemLocale: 'en-US',
        hasCompletedOnboarding: false
      })
    ).toBeNull()
  })

  it('uses explicit saved language before onboarding completion', () => {
    expect(
      resolveBootstrapUiLocale({
        savedLanguage: 'ja',
        hasCompletedOnboarding: false
      })
    ).toBe('ja')
  })

  it('falls back to system locale after onboarding completion', () => {
    expect(
      resolveBootstrapUiLocale({
        savedLanguage: 'system',
        systemLocale: 'en-US',
        hasCompletedOnboarding: true
      })
    ).toBe('en')
  })

  it('normalizes explicit app languages only', () => {
    expect(normalizeAppUiLanguage('zh-TW')).toBe('zh-TW')
    expect(normalizeAppUiLanguage('system')).toBeNull()
  })
})

describe('latte-assistant-prompt.defaults', () => {
  it('treats legacy default assistant prompt as factory', () => {
    expect(isLegacyDefaultAssistantSystemPrompt('你是一个友善且有创意的AI助手。')).toBe(true)
    expect(isFactoryLatteAssistantSystemPrompt('你是一个友善且有创意的AI助手。')).toBe(true)
  })

  it('recognizes the previous default prompt that mentioned the app name as factory', () => {
    const current = getDefaultLatteAssistantSystemPrompt('zh')
    const previous = current
      .replace('也是这个应用的看板娘', '也是白守的看板娘')
      .replace('让每一次对话都更有温度', '让每一次对话都让白守更有温度')
    expect(previous).not.toBe(current)
    expect(isFactoryLatteAssistantSystemPrompt(previous)).toBe(true)
    expect(current).not.toContain('白守')
  })

  it('returns localized default prompt', () => {
    expect(getDefaultLatteAssistantSystemPrompt('en').startsWith('You are Latte.')).toBe(true)
    expect(getDefaultLatteAssistantSystemPrompt('zh').includes('你是 Latte')).toBe(true)
    expect(getDefaultLatteAssistantSystemPrompt('zh').includes('## 爱好')).toBe(true)
    expect(getDefaultLatteAssistantSystemPrompt('zh').includes('## 典型台词')).toBe(true)
  })
})
