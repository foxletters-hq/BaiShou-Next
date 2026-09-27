import { describe, expect, it } from 'vitest'
import { resolveCompanionStreamUi } from '../companion-stream-ui.util'

const finishedAssistant = {
  role: 'assistant' as const,
  content: '已经说完了',
  parts: [{ type: 'text', data: { text: '已经说完了' } }]
}

const inProgressAssistant = {
  role: 'assistant' as const,
  content: '一半',
  parts: [
    { type: 'text', data: { text: '一半' } },
    { type: 'text', data: { text: '', streamStatus: 'in_progress' } }
  ]
}

describe('resolveCompanionStreamUi', () => {
  it('should hide empty waiting dots under a finished assistant reply', () => {
    const ui = resolveCompanionStreamUi({
      isStreaming: true,
      isBridgeActive: false,
      isCompressing: false,
      lastMessage: finishedAssistant
    })
    expect(ui.showStreamingBubble).toBe(false)
    expect(ui.composerBusy).toBe(false)
    expect(ui.hidePersistedLiveTurn).toBe(false)
  })

  it('should keep waiting dots after a user message before the first token', () => {
    const ui = resolveCompanionStreamUi({
      isStreaming: true,
      isBridgeActive: false,
      isCompressing: false,
      lastMessage: { role: 'user', content: '你好' }
    })
    expect(ui.showStreamingBubble).toBe(true)
    expect(ui.composerBusy).toBe(true)
  })

  it('should keep the live bubble while an in-progress assistant is hidden', () => {
    const ui = resolveCompanionStreamUi({
      isStreaming: true,
      isBridgeActive: false,
      isCompressing: false,
      lastMessage: inProgressAssistant,
      text: '一半'
    })
    expect(ui.hidePersistedLiveTurn).toBe(true)
    expect(ui.showStreamingBubble).toBe(true)
    expect(ui.composerBusy).toBe(true)
  })

  it('should ignore pending emoji_send timeline items as visible stream body', () => {
    const ui = resolveCompanionStreamUi({
      isStreaming: true,
      isBridgeActive: false,
      isCompressing: false,
      lastMessage: finishedAssistant,
      timeline: [{ kind: 'tool', name: 'emoji_send', text: '' }]
    })
    expect(ui.showStreamingBubble).toBe(false)
    expect(ui.composerBusy).toBe(false)
  })
})
