import { describe, expect, it } from 'vitest'
import {
  shouldHidePersistedStreamingAssistant,
  resolvePersistedAssistantStreamError
} from '../persisted-streaming-assistant.util'

describe('shouldHidePersistedStreamingAssistant', () => {
  it('should hide an in-progress assistant while the live stream is still showing', () => {
    expect(
      shouldHidePersistedStreamingAssistant({
        isStreaming: true,
        isBridgeActive: false,
        lastMessage: {
          role: 'assistant',
          parts: [{ type: 'text', data: { text: '', streamStatus: 'in_progress' } }]
        }
      })
    ).toBe(true)
  })

  it('should keep a finished assistant visible beside the composer', () => {
    expect(
      shouldHidePersistedStreamingAssistant({
        isStreaming: false,
        isBridgeActive: false,
        lastMessage: {
          role: 'assistant',
          parts: [{ type: 'text', data: { text: '好了' } }]
        }
      })
    ).toBe(false)
  })
})

describe('resolvePersistedAssistantStreamError', () => {
  const error = '检测到工具调用死循环，已中断本轮'

  it('should keep the live error off a previous finished assistant turn', () => {
    expect(
      resolvePersistedAssistantStreamError({
        messageRole: 'assistant',
        messageId: 'weather',
        lastAssistantMessageId: 'weather',
        lastMessageRole: 'user',
        streamError: error,
        liveBubbleVisible: true
      })
    ).toBeUndefined()
  })

  it('should put the error on the persisted assistant when the live bubble is gone', () => {
    expect(
      resolvePersistedAssistantStreamError({
        messageRole: 'assistant',
        messageId: 'a2',
        lastAssistantMessageId: 'a2',
        lastMessageRole: 'assistant',
        streamError: error,
        liveBubbleVisible: false
      })
    ).toBe(error)
  })
})
