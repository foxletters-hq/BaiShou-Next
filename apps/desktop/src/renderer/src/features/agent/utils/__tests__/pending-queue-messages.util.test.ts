import { describe, expect, it } from 'vitest'
import {
  excludePendingQueuedUserMessages,
  formatPendingQueueCountLabel,
  mergePendingQueueView,
  reconcileOptimisticAfterServer,
  resolvePendingInputId
} from '../pending-queue-messages.util'

describe('excludePendingQueuedUserMessages', () => {
  it('should hide user messages that belong to pending queue when list has matching ids', () => {
    const messages = [
      { id: 'u1', role: 'user' },
      { id: 'a1', role: 'assistant' },
      { id: 'u2', role: 'user' }
    ]
    expect(
      excludePendingQueuedUserMessages(messages, [{ userMessageId: 'u2' }, { userMessageId: 'x' }])
    ).toEqual([
      { id: 'u1', role: 'user' },
      { id: 'a1', role: 'assistant' }
    ])
  })

  it('should keep the chat bubble when the queue row has the same text but is already sent', () => {
    const messages = [
      { id: 'u1', role: 'user', content: '123123' },
      { id: 'a1', role: 'assistant', content: 'ok' }
    ]
    expect(excludePendingQueuedUserMessages(messages, [{ userMessageId: undefined }])).toBe(
      messages
    )
  })

  it('should return original list when pending has no userMessageId', () => {
    const messages = [{ id: 'u1' }]
    expect(excludePendingQueuedUserMessages(messages, [{ userMessageId: undefined }])).toBe(
      messages
    )
  })
})

describe('mergePendingQueueView', () => {
  it('should keep a local placeholder until the server list contains that id', () => {
    expect(mergePendingQueueView([{ id: 'server-1' }], [{ id: 'local-1' }])).toEqual([
      { id: 'server-1' },
      { id: 'local-1' }
    ])
  })

  it('should keep a not-yet-saved placeholder when the server list is still empty', () => {
    expect(reconcileOptimisticAfterServer([], [{ id: 'local-1', text: '下一条' }])).toEqual([
      { id: 'local-1', text: '下一条' }
    ])
  })

  it('should drop a confirmed local placeholder after the server list no longer has that turn', () => {
    expect(
      reconcileOptimisticAfterServer(
        [],
        [{ id: 'local-1', text: '立刻发送', userMessageId: 'u-sent' }]
      )
    ).toEqual([])
  })

  it('should not stack a local placeholder on the same text already queued', () => {
    expect(
      mergePendingQueueView(
        [{ id: 'server-1', text: '123123' }],
        [{ id: 'local-1', text: '123123' }]
      )
    ).toEqual([{ id: 'server-1', text: '123123' }])
  })
})

describe('resolvePendingInputId', () => {
  it('should map a local placeholder to the server input when the text matches', () => {
    expect(
      resolvePendingInputId({ id: 'local-1', text: '123123' }, [
        { id: 'server-9', text: '123123', userMessageId: 'u1' }
      ])
    ).toBe('server-9')
  })
})

describe('formatPendingQueueCountLabel', () => {
  it('should format Chinese count label when count is positive', () => {
    expect(formatPendingQueueCountLabel(2)).toBe('2 条排队中')
  })
})
