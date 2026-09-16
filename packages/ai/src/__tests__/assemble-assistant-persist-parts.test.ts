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
})
