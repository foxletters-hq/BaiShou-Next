import { describe, expect, it } from 'vitest'
import {
  mapWorkspaceContextAtMessage,
  toWorkspaceContextBubbleMessage
} from '../workspace-context-at-message.util'
import type { MockChatMessage } from '@baishou/shared'

const fallback: MockChatMessage = {
  id: 'a1',
  sessionId: 's1',
  role: 'assistant',
  content: '答',
  timestamp: new Date('2026-01-01T00:00:00.000Z')
}

const mappingOptions = {
  fallbackMessage: fallback,
  sessionId: 's1',
  sourceMessageId: 'a1',
  systemPromptLabel: '系统提示词',
  timestamp: new Date('2026-01-01T00:00:00.000Z')
}

describe('mapWorkspaceContextAtMessage', () => {
  it('should return null when the IPC result is empty', () => {
    expect(mapWorkspaceContextAtMessage(null, mappingOptions)).toBeNull()
    expect(mapWorkspaceContextAtMessage(undefined, mappingOptions)).toBeNull()
  })

  it('should map viewModel entries into ContextChainPanel items', () => {
    const mapped = mapWorkspaceContextAtMessage(
      {
        systemPrompt: '系统全文',
        compressedContent: '摘要',
        viewModel: {
          flatEntries: [
            { kind: 'round-header', roundIndex: 1 },
            { kind: 'compression-summary', summaryText: '摘要', reasoningText: '思考' },
            { kind: 'system-prompt', item: { content: '系统', role: 'system' } },
            { kind: 'message', roundIndex: 1, item: { role: 'user', content: '问' } }
          ],
          nextRequest: { estimatedInputTokens: 12, contextRoundLimit: 8, contextRoundCount: 2 },
          activeRoundIndex: 1
        }
      },
      mappingOptions
    )
    expect(mapped?.flatEntries).toEqual([
      { kind: 'round-header', roundIndex: 1 },
      { kind: 'compression-summary', summaryText: '摘要', reasoningText: '思考' },
      {
        kind: 'system-prompt',
        item: expect.objectContaining({
          id: 'ctx-sys-a1',
          role: 'system',
          content: '系统',
          label: '系统提示词'
        })
      },
      {
        kind: 'message',
        roundIndex: 1,
        item: expect.objectContaining({ id: 'ctx-a1-3', role: 'user', content: '问' })
      }
    ])
    expect(mapped?.compressedContent).toBe('摘要')
    expect(mapped?.systemPrompt).toBe('系统全文')
    expect(mapped?.meta.activeRoundIndex).toBe(1)
    expect(mapped?.message.id).toBe('a1')
  })
})

describe('toWorkspaceContextBubbleMessage', () => {
  it('should prefer user text parts when building the panel header message', () => {
    const message = toWorkspaceContextBubbleMessage(
      {
        id: 'u1',
        role: 'user',
        content: '你好'
      },
      's1'
    )
    expect(message.role).toBe('user')
    expect(message.content).toBe('你好')
    expect(message.sessionId).toBe('s1')
  })
})
