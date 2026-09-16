import { describe, expect, it } from 'vitest'
import { pickAgentIdleGreetingIndex } from '../agent-idle-greeting'

describe('pickAgentIdleGreetingIndex', () => {
  it('returns 0 when there is only one greeting', () => {
    expect(pickAgentIdleGreetingIndex(1)).toBe(0)
    expect(pickAgentIdleGreetingIndex(1, 0)).toBe(0)
  })

  it('stays within range on first pick', () => {
    for (let i = 0; i < 20; i += 1) {
      const index = pickAgentIdleGreetingIndex(10)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(10)
    }
  })

  it('avoids the previous index when reshuffling', () => {
    for (let previous = 0; previous < 10; previous += 1) {
      for (let i = 0; i < 20; i += 1) {
        const next = pickAgentIdleGreetingIndex(10, previous)
        expect(next).not.toBe(previous)
        expect(next).toBeGreaterThanOrEqual(0)
        expect(next).toBeLessThan(10)
      }
    }
  })
})
