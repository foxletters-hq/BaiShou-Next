import { describe, expect, it } from 'vitest'
import {
  KNOWLEDGE_CHAT_SOURCE_DOCK_MIN_WIDTH,
  hasKnowledgeChatSources,
  resolveKnowledgeChatSourceLayout
} from '../knowledge-chat-source-layout.util'

describe('knowledge-chat-source-layout.util', () => {
  it('treats uploading rows as existing sources', () => {
    expect(hasKnowledgeChatSources(0, 0)).toBe(false)
    expect(hasKnowledgeChatSources(1, 0)).toBe(true)
    expect(hasKnowledgeChatSources(0, 1)).toBe(true)
  })

  it('hides the source column when there is nothing to list', () => {
    expect(
      resolveKnowledgeChatSourceLayout({
        sourceCount: 0,
        uploadingCount: 0,
        workspaceWidth: 1200
      })
    ).toBe('hidden')
    expect(
      resolveKnowledgeChatSourceLayout({
        sourceCount: 0,
        workspaceWidth: 400
      })
    ).toBe('hidden')
  })

  it('docks the source column when the workspace is wide enough', () => {
    expect(
      resolveKnowledgeChatSourceLayout({
        sourceCount: 1,
        workspaceWidth: KNOWLEDGE_CHAT_SOURCE_DOCK_MIN_WIDTH
      })
    ).toBe('docked')
    expect(
      resolveKnowledgeChatSourceLayout({
        sourceCount: 0,
        uploadingCount: 1,
        workspaceWidth: 1100
      })
    ).toBe('docked')
  })

  it('collapses the source column when the workspace is narrow', () => {
    expect(
      resolveKnowledgeChatSourceLayout({
        sourceCount: 2,
        workspaceWidth: KNOWLEDGE_CHAT_SOURCE_DOCK_MIN_WIDTH - 1
      })
    ).toBe('collapsed')
  })

  it('docks before the first width measurement to avoid a collapsed flash', () => {
    expect(
      resolveKnowledgeChatSourceLayout({
        sourceCount: 1,
        workspaceWidth: null
      })
    ).toBe('docked')
  })
})
