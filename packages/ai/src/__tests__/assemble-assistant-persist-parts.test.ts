import { describe, expect, it } from 'vitest'
import { assembleAssistantPersistParts } from '../agent/assemble-assistant-persist-parts'
import { StreamAccumulator } from '../agent/stream-accumulator'

describe('assembleAssistantPersistParts', () => {
  it('should append an in_progress marker when assembling a streaming checkpoint', () => {
    const accumulator = new StreamAccumulator()
    accumulator.add({ type: 'text-delta', text: '半成品正文' })

    const parts = assembleAssistantPersistParts({
      accumulator,
      assistantMsgId: 'asst-1',
      sessionId: 's1',
      includeInProgressMarker: true
    })

    expect(parts.some((part) => part.data.text === '半成品正文')).toBe(true)
    expect(parts.some((part) => part.data.streamStatus === 'in_progress')).toBe(true)
  })

  it('should omit the in_progress marker when assembling the final persist', () => {
    const accumulator = new StreamAccumulator()
    accumulator.add({ type: 'text-delta', text: '最终正文' })

    const parts = assembleAssistantPersistParts({
      accumulator,
      assistantMsgId: 'asst-1',
      sessionId: 's1'
    })

    expect(parts.some((part) => part.data.streamStatus === 'in_progress')).toBe(false)
  })

  it('should place emoji image parts after timeline text when persisting', () => {
    const accumulator = new StreamAccumulator()
    accumulator.add({
      type: 'tool-call',
      toolCallId: 'e1',
      toolName: 'emoji_send',
      input: { emoji_id: 'cat.png' }
    })
    accumulator.add({ type: 'text-delta', text: '哈哈' })

    const parts = assembleAssistantPersistParts({
      accumulator,
      assistantMsgId: 'asst-1',
      sessionId: 's1',
      userConfig: {
        emojiConfig: {
          emojis: [{ id: 'cat.png', name: 'cat', relativePath: 'emojis/cat.png' }]
        }
      }
    })

    const textIndex = parts.findIndex((part) => part.type === 'text')
    const imageIndex = parts.findIndex((part) => part.type === 'image')
    expect(textIndex).toBeGreaterThanOrEqual(0)
    expect(imageIndex).toBeGreaterThan(textIndex)
    expect(Number(parts[imageIndex]?.data.seq)).toBeGreaterThan(Number(parts[textIndex]?.data.seq))
  })
})
