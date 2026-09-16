import { describe, expect, it } from 'vitest'
import { shouldPersistPartialAssistantAfterStop } from '../persist-aborted-assistant.util'

describe('shouldPersistPartialAssistantAfterStop', () => {
  it('should persist when the user stops after the model already produced output', () => {
    expect(
      shouldPersistPartialAssistantAfterStop({
        userAborted: true,
        doomTripped: false,
        superseded: false,
        hasModelOutput: true
      })
    ).toBe(true)
  })

  it('should skip persist when the user stops before any model output', () => {
    expect(
      shouldPersistPartialAssistantAfterStop({
        userAborted: true,
        doomTripped: false,
        superseded: false,
        hasModelOutput: false
      })
    ).toBe(false)
  })

  it('should skip persist when a doom-loop abort trips', () => {
    expect(
      shouldPersistPartialAssistantAfterStop({
        userAborted: true,
        doomTripped: true,
        superseded: false,
        hasModelOutput: true
      })
    ).toBe(false)
  })

  it('should skip persist when this stream was superseded', () => {
    expect(
      shouldPersistPartialAssistantAfterStop({
        userAborted: true,
        doomTripped: false,
        superseded: true,
        hasModelOutput: true
      })
    ).toBe(false)
  })
})
