import { describe, expect, it } from 'vitest'
import { isGraphHubLabelVisible } from '../graph-appearance-settings.util'

describe('isGraphHubLabelVisible', () => {
  it('shows name when degree reaches the threshold', () => {
    expect(
      isGraphHubLabelVisible({
        degree: 1,
        mentionCount: 0,
        hubLabelMinDegree: 1,
        hubLabelMinMentions: 1
      })
    ).toBe(true)
  })

  it('hides name when both degree and mentions stay below threshold', () => {
    expect(
      isGraphHubLabelVisible({
        degree: 0,
        mentionCount: 0,
        hubLabelMinDegree: 1,
        hubLabelMinMentions: 1
      })
    ).toBe(false)
  })

  it('shows name when mentionCount reaches the threshold', () => {
    expect(
      isGraphHubLabelVisible({
        degree: 0,
        mentionCount: 1,
        hubLabelMinDegree: 3,
        hubLabelMinMentions: 1
      })
    ).toBe(true)
  })
})
