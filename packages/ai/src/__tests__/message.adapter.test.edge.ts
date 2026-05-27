import { describe, it, expect } from 'vitest'
import { MessageAdapter, type MessageWithParts } from '../agent/message.adapter'
import {
  makeAssistantMsg,
  makeTextPart,
  makeToolPart,
  makeUserMsg
} from './message.adapter.test.fixtures'

describe('MessageAdapter.toVercelMessages edge cases', () => {
  describe('助理消息中的工具调用 (tool parts in assistant messages)', () => {
    it('should still handle existing tool role messages from DB correctly', async () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        {
          id: 'msg-tool-1',
          sessionId: 'sess-1',
          role: 'tool' as const,
          isSummary: false,
          orderIndex: 1,
          createdAt: new Date(),
          parts: [
            {
              id: 'part-tool-1',
              messageId: 'msg-tool-1',
              sessionId: 'sess-1',
              type: 'tool' as const,
              data: {
                callId: 'call_existing',
                name: 'web_search',
                result: '已有结果',
                status: 'completed'
              }
            }
          ]
        }
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      expect(result).toHaveLength(2)
      expect(result[0]?.role).toBe('user')
      expect(result[1]?.role).toBe('tool')
      const toolResults = (result[1]!.content as Array<{ type: string; output?: unknown }>).filter(
        (p) => p.type === 'tool-result'
      )
      expect(toolResults).toHaveLength(1)
      expect(toolResults[0]!.output).toEqual({ type: 'text', value: '已有结果' })
    })

    it('should skip assistant messages with no parts', async () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('你好'),
        makeAssistantMsg([]),
        makeUserMsg('你还在吗'),
        makeAssistantMsg([makeTextPart('我在')])
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      expect(result).toHaveLength(3)
      expect(result[0]?.role).toBe('user')
      expect(result[1]?.role).toBe('user')
      expect(result[2]?.role).toBe('assistant')
    })

    it('should skip tool parts without callId or name', async () => {
      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        makeAssistantMsg([
          makeTextPart('文本'),
          {
            id: 'part-invalid',
            messageId: 'msg-1',
            sessionId: 'sess-1',
            type: 'tool' as const,
            data: { result: '无ID的结果' }
          }
        ])
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      expect(result).toHaveLength(2)
      const contentArr = result[1]!.content as Array<{ type: string }>
      expect(contentArr.filter((p) => p.type === 'tool-call')).toHaveLength(0)
      expect(contentArr).toHaveLength(1)
      expect(contentArr[0]!.type).toBe('text')
    })

    it('should pass Vercel SDK validation: tool-call count matches tool-result count', async () => {
      const toolData = [
        {
          callId: 'call_1',
          name: 'web_search',
          arguments: '{}',
          result: 'r1',
          status: 'completed'
        },
        {
          callId: 'call_2',
          name: 'url_read',
          arguments: '{}',
          result: 'r2',
          status: 'completed'
        }
      ]

      const dbMessages: MessageWithParts[] = [
        makeUserMsg('搜索'),
        makeAssistantMsg([
          makeTextPart('正在搜索...'),
          makeToolPart({ data: toolData[0] }),
          makeToolPart({ data: toolData[1] })
        ])
      ]

      const result = await MessageAdapter.toVercelMessages(dbMessages)

      const assistantContent = result[1]!.content as Array<{ type: string }>
      const toolCallCount = assistantContent.filter((p) => p.type === 'tool-call').length
      const toolContent = result[2]!.content as Array<{ type: string }>
      const toolResultCount = toolContent.filter((p) => p.type === 'tool-result').length

      expect(toolCallCount).toBe(toolResultCount)
      expect(toolCallCount).toBe(2)
    })
  })
})
