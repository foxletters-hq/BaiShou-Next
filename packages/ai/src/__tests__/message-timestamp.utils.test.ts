import { describe, it, expect } from 'vitest'
import { injectModelMetadata } from '@baishou/shared'

describe('injectModelMetadata (adapter integration)', () => {
  const at = new Date(2026, 5, 15, 14, 30)

  it('wraps plain string with message-time and message-content', () => {
    expect(injectModelMetadata('你好', 'user', at)).toBe(
      '<message-time>2026-06-15 14:30</message-time>\n<message-content>\n你好\n</message-content>'
    )
  })

  it('wraps first text part in multimodal content', () => {
    const result = injectModelMetadata(
      [{ type: 'text', text: '查天气' }, { type: 'image', image: 'x' }],
      'user',
      at
    )
    expect(Array.isArray(result)).toBe(true)
    expect((result as Array<{ text?: string }>)[0]?.text).toBe(
      '<message-time>2026-06-15 14:30</message-time>\n<message-content>\n查天气\n</message-content>'
    )
  })

  it('returns content unchanged when createdAt is missing', () => {
    expect(injectModelMetadata('hello', 'user', undefined)).toBe('hello')
  })
})
