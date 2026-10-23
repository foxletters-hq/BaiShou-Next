import { describe, expect, it } from 'vitest'
import { hasPersistedAssistantTail } from '../workspace-persisted-assistant.util'

describe('hasPersistedAssistantTail', () => {
  it('should be true when the last message is an assistant with text', () => {
    expect(
      hasPersistedAssistantTail([
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: '一半回复' }
      ])
    ).toBe(true)
  })

  it('should be false when only the user turn has been persisted', () => {
    expect(hasPersistedAssistantTail([{ role: 'user', content: 'hi' }])).toBe(false)
  })
})
