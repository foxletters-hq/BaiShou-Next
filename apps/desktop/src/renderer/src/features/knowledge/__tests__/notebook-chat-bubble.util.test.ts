import { describe, expect, it } from 'vitest'
import { toNotebookChatBubbleMessage } from '../notebook-chat-bubble.util'

describe('toNotebookChatBubbleMessage', () => {
  it('maps a notebook record onto the shared chat bubble message', () => {
    const bubble = toNotebookChatBubbleMessage({
      id: 'ncm_1',
      sessionId: 'ncs_1',
      role: 'assistant',
      text: '结论写在第二节。',
      reasoning: '先对来源做比对。',
      createdAt: 1_700_000_000_000
    })

    expect(bubble).toMatchObject({
      id: 'ncm_1',
      sessionId: 'ncs_1',
      role: 'assistant',
      content: '结论写在第二节。',
      reasoning: '先对来源做比对。'
    })
    expect(bubble.timestamp.getTime()).toBe(1_700_000_000_000)
  })
})
