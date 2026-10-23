import { describe, expect, it } from 'vitest'
import { applySessionReasoningEffort } from '../agent-helpers.util'

describe('applySessionReasoningEffort', () => {
  it('should keep the original config when effort is auto or empty', () => {
    const userConfig = { reasoningEffort: 'low' }
    expect(applySessionReasoningEffort(userConfig, 'auto')).toBe(userConfig)
    expect(applySessionReasoningEffort(userConfig, null)).toBe(userConfig)
    expect(applySessionReasoningEffort(userConfig, '')).toBe(userConfig)
  })

  it('should override reasoningEffort when a concrete effort is selected', () => {
    expect(applySessionReasoningEffort({ reasoningEffort: 'low' }, 'high')).toEqual({
      reasoningEffort: 'high'
    })
  })
})
