import { describe, expect, it } from 'vitest'
import { sanitizeAssistantGeneratedText } from '../sanitizer'

describe('sanitizeAssistantGeneratedText leaked tool markup', () => {
  it('should drop a closed function_calls block from assistant text', () => {
    expect(
      sanitizeAssistantGeneratedText(
        '先回答两个问题。\n<function_calls>\n<invoke name="companion_ask">{"question":"用途？"}</invoke>\n</function_calls>'
      )
    ).toBe('先回答两个问题。')
  })

  it('should hide an unclosed function_calls tail so the stream does not look stuck on XML', () => {
    expect(
      sanitizeAssistantGeneratedText(
        '先挑豆子：回答下面两个问题就好。\n<function_calls>\n<invoke name="companion_ask">'
      )
    ).toBe('先挑豆子：回答下面两个问题就好。')
  })
})
