import { describe, expect, it, vi } from 'vitest'
import { notifyMobileSkillsChanged, subscribeMobileSkillsChanged } from '../mobile-skills-events'

describe('mobile-skills-events', () => {
  it('should notify current subscribers and ignore unsubscribed listeners', () => {
    const first = vi.fn()
    const second = vi.fn()
    const unsubscribeFirst = subscribeMobileSkillsChanged(first)
    const unsubscribeSecond = subscribeMobileSkillsChanged(second)

    notifyMobileSkillsChanged()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)

    unsubscribeFirst()
    notifyMobileSkillsChanged()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)

    unsubscribeSecond()
  })
})
