import { describe, it, expect } from 'vitest'
import type { ModelMessage } from 'ai'
import {
  sanitizeModelMessages,
  sanitizeOpenAiChatMessages
} from '../agent/message-sequence-sanitizer'

describe('message-sequence-sanitizer', () => {
  describe('sanitizeModelMessages', () => {
    it('returns empty array when given empty messages', () => {
      expect(sanitizeModelMessages([])).toEqual([])
    })

    it('synthesizes assistant tool-call anchor for orphan tool message after user', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: '查询天气' },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_weather_1',
              toolName: 'get_weather',
              output: { type: 'text', value: '晴 25℃' }
            }
          ]
        },
        { role: 'user', content: '你刚才丢了哪个工具吗？' }
      ]

      const sanitized = sanitizeModelMessages(messages)

      expect(sanitized).toHaveLength(4)
      expect(sanitized[0]?.role).toBe('user')
      // 第二条被自愈为 assistant 带有 tool-call
      expect(sanitized[1]?.role).toBe('assistant')
      const assistantCalls = (sanitized[1]?.content as any[]).filter((p) => p.type === 'tool-call')
      expect(assistantCalls).toHaveLength(1)
      expect(assistantCalls[0].toolCallId).toBe('call_weather_1')
      expect(assistantCalls[0].toolName).toBe('get_weather')

      // 第三条是 tool 消息
      expect(sanitized[2]?.role).toBe('tool')
      // 第四条是用户追问
      expect(sanitized[3]?.role).toBe('user')
    })

    it('synthesizes assistant tool-call anchor when tool message is at the very beginning', () => {
      const messages: ModelMessage[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_orphan_head',
              toolName: 'bash',
              output: { type: 'text', value: 'output' }
            }
          ]
        },
        { role: 'user', content: '继续' }
      ]

      const sanitized = sanitizeModelMessages(messages)

      expect(sanitized[0]?.role).toBe('assistant')
      expect(sanitized[1]?.role).toBe('tool')
      expect(sanitized[2]?.role).toBe('user')
    })

    it('appends missing tool-call to preceding text-only assistant message', () => {
      const messages: ModelMessage[] = [
        { role: 'assistant', content: '稍等，我来处理。' },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_calc_1',
              toolName: 'calculator',
              output: { type: 'text', value: '42' }
            }
          ]
        }
      ]

      const sanitized = sanitizeModelMessages(messages)

      expect(sanitized).toHaveLength(2)
      expect(sanitized[0]?.role).toBe('assistant')
      const parts = sanitized[0]!.content as any[]
      expect(parts.some((p) => p.type === 'tool-call' && p.toolCallId === 'call_calc_1')).toBe(true)
      expect(sanitized[1]?.role).toBe('tool')
    })

    it('synthesizes placeholder tool-result when assistant tool-call was not completed before next turn', () => {
      const messages: ModelMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_interrupted',
              toolName: 'long_task',
              input: {}
            }
          ]
        },
        { role: 'user', content: '取消刚才的，换个任务' }
      ]

      const sanitized = sanitizeModelMessages(messages)

      expect(sanitized).toHaveLength(3)
      expect(sanitized[0]?.role).toBe('assistant')
      expect(sanitized[1]?.role).toBe('tool')
      const toolResults = sanitized[1]!.content as any[]
      expect(toolResults[0].toolCallId).toBe('call_interrupted')
      expect(toolResults[0].output.value).toContain('[工具调用已被取消或中断]')
      expect(sanitized[2]?.role).toBe('user')
    })
  })

  describe('sanitizeOpenAiChatMessages', () => {
    it('synthesizes preceding assistant tool-calls in raw chat completions payload', () => {
      const rawMessages = [
        { role: 'user', content: '查一下' },
        { role: 'tool', tool_call_id: 'call_orphan_http', content: '一些结果' },
        { role: 'user', content: '你刚才丢了哪个工具吗？' }
      ]

      const result = sanitizeOpenAiChatMessages(rawMessages)

      expect(result.mutated).toBe(true)
      expect(result.messages).toHaveLength(4)
      expect(result.messages[0].role).toBe('user')
      expect(result.messages[1].role).toBe('assistant')
      expect(result.messages[1].tool_calls).toEqual([
        {
          id: 'call_orphan_http',
          type: 'function',
          function: { name: 'unknown', arguments: '{}' }
        }
      ])
      expect(result.messages[2].role).toBe('tool')
      expect(result.messages[3].role).toBe('user')
    })

    it('synthesizes missing tool response when assistant tool_calls are followed by user', () => {
      const rawMessages = [
        {
          role: 'assistant',
          content: '正在调用...',
          tool_calls: [
            {
              id: 'call_pending',
              type: 'function',
              function: { name: 'fetch_data', arguments: '{}' }
            }
          ]
        },
        { role: 'user', content: '停止' }
      ]

      const result = sanitizeOpenAiChatMessages(rawMessages)

      expect(result.mutated).toBe(true)
      expect(result.messages).toHaveLength(3)
      expect(result.messages[0].role).toBe('assistant')
      expect(result.messages[1].role).toBe('tool')
      expect(result.messages[1].tool_call_id).toBe('call_pending')
      expect(result.messages[1].content).toContain('[工具执行被中断或取消]')
      expect(result.messages[2].role).toBe('user')
    })

    it('leaves fully matching tool sequence untouched', () => {
      const rawMessages = [
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'c1',
              type: 'function',
              function: { name: 'test', arguments: '{}' }
            }
          ]
        },
        { role: 'tool', tool_call_id: 'c1', content: 'ok' },
        { role: 'user', content: '收到' }
      ]

      const result = sanitizeOpenAiChatMessages(rawMessages)

      expect(result.mutated).toBe(false)
      expect(result.messages).toHaveLength(3)
    })
  })
})
