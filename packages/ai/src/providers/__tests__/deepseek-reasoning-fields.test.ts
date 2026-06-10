import { describe, it, expect } from 'vitest'
import { applyDeepSeekReasoningFields } from '../openai.provider'

const OPEN = '<' + 'redacted_thinking>'
const CLOSE = '<' + '/redacted_thinking>'

describe('applyDeepSeekReasoningFields', () => {
  it('extracts reasoning_content and strips think tags from assistant content', () => {
    const msg: {
      role: string
      content: string
      reasoning_content?: string
    } = {
      role: 'assistant',
      content: `${OPEN}\n推理过程\n${CLOSE}\n正式回复`
    }

    applyDeepSeekReasoningFields(msg)

    expect(msg.reasoning_content).toBe('推理过程')
    expect(msg.content).toBe('正式回复')
  })

  it('sets content to null when only think tags remain (tool-call messages)', () => {
    const msg: {
      role: string
      content: string | null
      reasoning_content?: string
      tool_calls: { id: string }[]
    } = {
      role: 'assistant',
      content: `${OPEN}\n仅推理\n${CLOSE}`,
      tool_calls: [{ id: 'call_1' }]
    }

    applyDeepSeekReasoningFields(msg)

    expect(msg.reasoning_content).toBe('仅推理')
    expect(msg.content).toBeNull()
    expect(msg.tool_calls).toHaveLength(1)
  })

  it('ignores non-assistant messages', () => {
    const msg = { role: 'user', content: `${OPEN}x${CLOSE}` }
    applyDeepSeekReasoningFields(msg)
    expect(msg).toEqual({ role: 'user', content: `${OPEN}x${CLOSE}` })
  })
})
