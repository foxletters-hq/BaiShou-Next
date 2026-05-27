import { describe, it, expect } from 'vitest'
import { MessageAdapter, type MessageWithParts } from '../agent/message.adapter'
import {
  makeAssistantMsg,
  makeTextPart,
  makeToolPart,
  makeUserMsg
} from './message.adapter.test.fixtures'

describe('MessageAdapter.toVercelMessages', () => {
  describe('助理消息中的工具调用 (tool parts in assistant messages)', () => {
    it('should generate tool-call in assistant and tool-result in tool message when tool part has result', async () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索新闻'),
        makeAssistantMsg([makeTextPart('正在搜索...'), makeToolPart()])
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      expect(result).toHaveLength(3)

      // 用户消息
      expect(result[0]?.role).toBe('user')

      // 助理消息应包含 tool-call
      const assistantMsg = result[1]!
      expect(assistantMsg?.role).toBe('assistant')
      expect(assistantMsg?.content).toBeInstanceOf(Array)
      const contentArr = assistantMsg.content as any[]
      const toolCalls = contentArr.filter((p: any) => p.type === 'tool-call')
      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0].toolCallId).toBe('call_00_test123')
      expect(toolCalls[0].toolName).toBe('web_search')

      // tool 消息应包含 tool-result
      const toolMsg = result[2]!
      expect(toolMsg?.role).toBe('tool')
      expect(toolMsg?.content).toBeInstanceOf(Array)
      const toolResults = (toolMsg.content as any[]).filter((p: any) => p.type === 'tool-result')
      expect(toolResults).toHaveLength(1)
      expect(toolResults[0].toolCallId).toBe('call_00_test123')
      expect(toolResults[0].toolName).toBe('web_search')
      expect(toolResults[0].output).toEqual({
        type: 'text',
        value: '搜索结果内容'
      })
    })

    it('should generate tool-result with fallback error when tool part has no result', async () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索新闻'),
        makeAssistantMsg([makeToolPart({ result: undefined, status: 'failed' })])
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      expect(result).toHaveLength(3)
      const toolMsg = result[2]!
      const toolResults = (toolMsg?.content as any[]).filter((p: any) => p.type === 'tool-result')
      expect(toolResults).toHaveLength(1)
      expect(toolResults[0].output).toEqual({
        type: 'text',
        value: '[工具执行失败: web_search]'
      })
    })

    it('should handle multiple tool parts in one assistant message', async () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索并读取'),
        makeAssistantMsg([
          makeTextPart('让我来搜索'),
          makeToolPart({
            callId: 'call_01',
            name: 'web_search',
            arguments: '{}',
            result: '结果1',
            status: 'completed'
          }),
          makeToolPart({
            callId: 'call_02',
            name: 'url_read',
            arguments: '{}',
            result: '结果2',
            status: 'completed'
          })
        ])
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      expect(result).toHaveLength(3)

      const assistantMsg = result[1]!
      const contentArr = assistantMsg.content as any[]
      const toolCalls = contentArr.filter((p: any) => p.type === 'tool-call')
      expect(toolCalls).toHaveLength(2)

      const toolMsg = result[2]!
      const toolResults = (toolMsg.content as any[]).filter((p: any) => p.type === 'tool-result')
      expect(toolResults).toHaveLength(2)
      expect(toolResults[0].output).toEqual({ type: 'text', value: '结果1' })
      expect(toolResults[1].output).toEqual({ type: 'text', value: '结果2' })
    })

    it('should NOT generate a tool message when assistant has no tool parts', async () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('你好'),
        makeAssistantMsg([makeTextPart('你好！有什么可以帮助你的？')])
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      expect(result).toHaveLength(2)
      expect(result[0]?.role).toBe('user')
      expect(result[1]?.role).toBe('assistant')
    })

    it('should place tool messages immediately after their corresponding assistant message', async () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('第一次'),
        makeAssistantMsg([
          makeToolPart({
            callId: 'call_a',
            name: 'web_search',
            arguments: '{}',
            result: '结果A',
            status: 'completed'
          })
        ]),
        makeUserMsg('第二次'),
        makeAssistantMsg([
          makeToolPart({
            callId: 'call_b',
            name: 'url_read',
            arguments: '{}',
            result: '结果B',
            status: 'completed'
          })
        ])
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      // 期望顺序: user, assistant(call_a), tool(result_a), user, assistant(call_b), tool(result_b)
      expect(result).toHaveLength(6)
      expect(result[0]?.role).toBe('user')
      expect(result[1]?.role).toBe('assistant')
      expect(
        (result[1]!.content as any[]).filter((p: any) => p.type === 'tool-call')[0]!.toolCallId
      ).toBe('call_a')
      expect(result[2]?.role).toBe('tool')
      expect((result[2]!.content as any[])[0]!.toolCallId).toBe('call_a')
      expect(result[3]?.role).toBe('user')
      expect(result[4]?.role).toBe('assistant')
      expect(
        (result[4]!.content as any[]).filter((p: any) => p.type === 'tool-call')[0]!.toolCallId
      ).toBe('call_b')
      expect(result[5]?.role).toBe('tool')
      expect((result[5]!.content as any[])[0]!.toolCallId).toBe('call_b')
    })

    it('should correctly parse stringified arguments', async () => {
      const args = { queries: ['最新 Flutter 特性', 'Flutter 迁移指南'] }
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        makeAssistantMsg([
          makeToolPart({
            callId: 'call_c',
            name: 'web_search',
            arguments: JSON.stringify(args),
            result: '结果C',
            status: 'completed'
          })
        ])
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      const assistantMsg = result[1]!
      const toolCall = (assistantMsg.content as any[]).find((p: any) => p.type === 'tool-call')
      expect(toolCall.args).toEqual(args)
    })

    it('should use empty object as args when arguments is not a string', async () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        makeAssistantMsg([
          makeToolPart({
            callId: 'call_d',
            name: 'web_search',
            arguments: null as any,
            result: '结果D',
            status: 'completed'
          })
        ])
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      const assistantMsg = result[1]!
      const toolCall = (assistantMsg.content as any[]).find((p: any) => p.type === 'tool-call')
      expect(toolCall.args).toEqual({})
    })

    it('should handle reasoning parts alongside tool parts', async () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        makeAssistantMsg([makeTextPart('思考过程', true), makeTextPart('执行搜索'), makeToolPart()])
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      const assistantMsg = result[1]!
      const contentArr = assistantMsg.content as any[]
      expect(contentArr).toHaveLength(3)
      expect(contentArr[0].type).toBe('reasoning')
      expect(contentArr[1].type).toBe('text')
      expect(contentArr[2].type).toBe('tool-call')

      const toolMsg = result[2]!
      expect(toolMsg?.role).toBe('tool')
    })
  })
})
