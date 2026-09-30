import { describe, expect, it } from 'vitest'
import { extractLeakedCompanionAsk } from '../leaked-companion-ask.util'

describe('extractLeakedCompanionAsk', () => {
  it('should return null when the invoke block is still open', () => {
    expect(
      extractLeakedCompanionAsk('先提问。\n<function_calls>\n<invoke name="companion_ask">')
    ).toBeNull()
  })

  it('should read JSON arguments from a closed companion_ask invoke', () => {
    expect(
      extractLeakedCompanionAsk(
        '先提问。\n<function_calls>\n<invoke name="companion_ask">{"question":"用途是什么？","options":["日记","代码"]}</invoke>\n</function_calls>'
      )
    ).toEqual({
      question: '用途是什么？',
      options: ['日记', '代码']
    })
  })

  it('should read parameter tags from a closed companion_ask invoke', () => {
    expect(
      extractLeakedCompanionAsk(
        '<invoke name="companion_ask"><parameter name="question">想解决什么？</parameter><parameter name="options">["写作","编程"]</parameter></invoke>'
      )
    ).toEqual({
      question: '想解决什么？',
      options: ['写作', '编程']
    })
  })
})
