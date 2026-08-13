import { describe, it, expect } from 'vitest'
import {
  applyChatCompletionsReasoningEffortForTools,
  applyDeepSeekReasoningFields
} from '../openai.provider'

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

  it('sets content to empty string when only think tags remain (tool-call messages)', () => {
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
    expect(msg.content).toBe('')
    expect(msg.tool_calls).toHaveLength(1)
  })

  it('adds empty reasoning_content for tool-call messages missing think tags', () => {
    const msg: {
      role: string
      content: string
      reasoning_content?: string
      tool_calls: { id: string }[]
    } = {
      role: 'assistant',
      content: '',
      tool_calls: [{ id: 'call_1' }]
    }

    applyDeepSeekReasoningFields(msg)

    expect(msg.reasoning_content).toBe('')
    expect(msg.content).toBe('')
  })

  it('adds empty reasoning_content for plain assistant messages', () => {
    const msg: { role: string; content: string; reasoning_content?: string } = {
      role: 'assistant',
      content: 'hello'
    }
    applyDeepSeekReasoningFields(msg)
    expect(msg.reasoning_content).toBe('')
    expect(msg.content).toBe('hello')
  })

  it('extracts think tags as well as redacted_thinking', () => {
    const open = '<' + 'think>'
    const close = '<' + '/think>'
    const msg: { role: string; content: string; reasoning_content?: string } = {
      role: 'assistant',
      content: `${open}\n推理\n${close}\n正文`
    }
    applyDeepSeekReasoningFields(msg)
    expect(msg.reasoning_content).toBe('推理')
    expect(msg.content).toBe('正文')
  })

  it('ignores non-assistant messages', () => {
    const msg = { role: 'user', content: `${OPEN}x${CLOSE}` }
    applyDeepSeekReasoningFields(msg)
    expect(msg).toEqual({ role: 'user', content: `${OPEN}x${CLOSE}` })
  })
})

describe('applyChatCompletionsReasoningEffortForTools', () => {
  it('forces reasoning_effort none for gpt-5 + tools', () => {
    const body: { model: string; tools: unknown[]; reasoning_effort?: string } = {
      model: 'gpt-5.6-sol',
      tools: [{ type: 'function', function: { name: 'x' } }]
    }
    expect(applyChatCompletionsReasoningEffortForTools(body)).toBe(true)
    expect(body.reasoning_effort).toBe('none')
  })

  it('does not mutate when already none or without tools', () => {
    const withNone = {
      model: 'gpt-5',
      tools: [{ type: 'function' }],
      reasoning_effort: 'none' as const
    }
    expect(applyChatCompletionsReasoningEffortForTools(withNone)).toBe(false)

    const noTools = { model: 'gpt-5', tools: [] as unknown[] }
    expect(applyChatCompletionsReasoningEffortForTools(noTools)).toBe(false)

    const nonReasoning = {
      model: 'gpt-4o',
      tools: [{ type: 'function' }]
    }
    expect(applyChatCompletionsReasoningEffortForTools(nonReasoning)).toBe(false)
  })
})
