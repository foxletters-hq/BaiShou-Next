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

  it('should treat visible live gate parts as visible stream body only while session is live', () => {
    const idleWithGate = resolveCompanionStreamUi({
      isStreaming: false,
      isBridgeActive: false,
      isCompressing: false,
      lastMessage: finishedAssistant,
      liveGatePartsCount: 1
    })
    expect(idleWithGate.showStreamingBubble).toBe(false)

    const liveWithGate = resolveCompanionStreamUi({
      isStreaming: true,
      isBridgeActive: false,
      isCompressing: false,
      lastMessage: { role: 'user', content: '执行工具' },
      liveGatePartsCount: 1
    })
    expect(liveWithGate.showStreamingBubble).toBe(true)
  })

  it('should keep streaming bubble active during bridge when persistedMessageId has not matched lastMessage', () => {
    const historicalAssistant = {
      id: 'msg-prev-assistant',
      role: 'assistant' as const,
      content: '上一轮的回复内容',
      parts: [{ type: 'text', data: { text: '上一轮的回复内容' } }]
    }

    // 流式刚刚结束，开启桥接，已得到新消息 ID msg-current-assistant，但列表中的 lastMessage 还是上一轮的历史回复
    const uiWaitingHandoff = resolveCompanionStreamUi({
      isStreaming: false,
      isBridgeActive: true,
      persistedMessageId: 'msg-current-assistant',
      isCompressing: false,
      lastMessage: historicalAssistant,
      text: '当前轮刚刚流式输出的内容'
    })
    expect(uiWaitingHandoff.showStreamingBubble).toBe(true)

    // 当数据库新消息刷新出来后，lastMessage 的 ID 变成了 msg-current-assistant，此时无缝交接
    const currentAssistant = {
      id: 'msg-current-assistant',
      role: 'assistant' as const,
      content: '当前轮刚刚流式输出的内容',
      parts: [{ type: 'text', data: { text: '当前轮刚刚流式输出的内容' } }]
    }
    const uiHandoffCompleted = resolveCompanionStreamUi({
      isStreaming: false,
      isBridgeActive: true,
      persistedMessageId: 'msg-current-assistant',
      isCompressing: false,
      lastMessage: currentAssistant,
      text: '当前轮刚刚流式输出的内容'
    })
    expect(uiHandoffCompleted.showStreamingBubble).toBe(false)
  })
})
