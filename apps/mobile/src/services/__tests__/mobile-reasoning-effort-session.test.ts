import { describe, expect, it } from 'vitest'
import { applyMobileSessionReasoningEffort } from '../mobile-reasoning-effort-session'

describe('applyMobileSessionReasoningEffort', () => {
  it('should keep auto from writing over the setting default', () => {
    const next = applyMobileSessionReasoningEffort({ reasoningEffort: 'medium' }, 'auto')
    expect(next.reasoningEffort).toBe('medium')
  })

  it('should override with a concrete session effort', () => {
    const next = applyMobileSessionReasoningEffort({ reasoningEffort: 'medium' }, 'high')
    expect(next.reasoningEffort).toBe('high')
  })
})
