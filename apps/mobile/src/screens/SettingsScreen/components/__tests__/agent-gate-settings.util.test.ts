import { describe, expect, it } from 'vitest'
import { clampAgentGateRepeatThreshold } from '../agent-gate-settings.util'

describe('clampAgentGateRepeatThreshold', () => {
  it('should return null when the text is not a finite number', () => {
    expect(clampAgentGateRepeatThreshold('abc')).toBeNull()
  })

  it('should clamp the value into 0-20 when the input is out of range', () => {
    expect(clampAgentGateRepeatThreshold('-3')).toBe(0)
    expect(clampAgentGateRepeatThreshold('99')).toBe(20)
    expect(clampAgentGateRepeatThreshold('4.8')).toBe(4)
  })
})
