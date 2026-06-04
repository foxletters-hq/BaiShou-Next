import { describe, it, expect } from 'vitest'
import {
  DEFAULT_COMPRESSION_SYSTEM_PROMPTS,
  getDefaultCompressionSystemPrompt,
  resolveCompressionPromptLocale
} from '../compression-prompt.defaults'

describe('compression-prompt.defaults', () => {
  it('zh default focuses on companion memory not code specs', () => {
    const zh = DEFAULT_COMPRESSION_SYSTEM_PROMPTS.zh
    expect(zh).toContain('情感陪伴')
    expect(zh).toContain('关键事件')
    expect(zh).toContain('情绪')
    expect(zh).toContain('<previous-summary>')
    expect(zh).not.toContain('代码、路径、命令、错误、偏好、待办')
  })

  it('resolves locale for getDefaultCompressionSystemPrompt', () => {
    expect(resolveCompressionPromptLocale('en-US')).toBe('en')
    expect(resolveCompressionPromptLocale('zh-TW')).toBe('zh-TW')
    expect(getDefaultCompressionSystemPrompt('ja')).toBe(DEFAULT_COMPRESSION_SYSTEM_PROMPTS.ja)
  })

  it('provides all four locales', () => {
    expect(Object.keys(DEFAULT_COMPRESSION_SYSTEM_PROMPTS).sort()).toEqual(
      ['en', 'ja', 'zh', 'zh-TW'].sort()
    )
  })
})
