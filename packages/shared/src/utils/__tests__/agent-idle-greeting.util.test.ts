import { describe, expect, it } from 'vitest'
import { pickAgentIdleGreetingIndex } from '../agent-idle-greeting.util'

describe('pickAgentIdleGreetingIndex', () => {
  it('should stay at zero when there is only one greeting', () => {
    expect(pickAgentIdleGreetingIndex(1)).toBe(0)
  })

  it('should avoid the previous index when length is greater than one', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(pickAgentIdleGreetingIndex(10, 3)).not.toBe(3)
    }
  })
})
