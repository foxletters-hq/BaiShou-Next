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

  it('returns localized default prompt', () => {
    expect(getDefaultLatteAssistantSystemPrompt('en').startsWith('You are Latte.')).toBe(true)
    expect(getDefaultLatteAssistantSystemPrompt('zh').includes('你是 Latte')).toBe(true)
  })
})
