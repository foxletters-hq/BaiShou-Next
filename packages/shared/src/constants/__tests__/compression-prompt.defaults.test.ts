import { describe, it, expect } from 'vitest'
import {
  DEFAULT_COMPRESSION_SYSTEM_PROMPTS,
  getDefaultCompressionSystemPrompt,
  resolveCompressionPromptLocale,
  adaptCompressionSystemPrompt
} from '../compression-prompt.defaults'

describe('compression-prompt.defaults', () => {
  it('zh default focuses on companion memory not code specs', () => {
    const zh = DEFAULT_COMPRESSION_SYSTEM_PROMPTS.zh
    expect(zh).toContain('记忆压缩专家')
    expect(zh).toContain('关键事件')
    expect(zh).toContain('情绪')
    expect(zh).toContain('<previous-summary>')
    expect(zh).toContain('只输出滚动摘要正文')
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

  it('getDefaultCompressionSystemPrompt omits message-time metadata when wrapMessageTime is false', () => {
    const withMeta = getDefaultCompressionSystemPrompt('zh')
    const plain = getDefaultCompressionSystemPrompt('zh', { wrapMessageTime: false })
    expect(withMeta).toContain('<message-time>')
    expect(plain).not.toContain('<message-time>')
    expect(plain).toContain('纯文本')
  })

  it('adaptCompressionSystemPrompt adjusts custom prompts when wrapMessageTime is false', () => {
    const custom = DEFAULT_COMPRESSION_SYSTEM_PROMPTS.en
    const adapted = adaptCompressionSystemPrompt(custom, 'en', { wrapMessageTime: false })
    expect(custom).toContain('<message-time>')
    expect(adapted).not.toContain('<message-time>')
    expect(adapted).toContain('plain text')
  })
})
