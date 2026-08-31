import { describe, expect, it } from 'vitest'
import {
  MEMORY_ONBOARDING_DISMISSED_KEY,
  persistMemoryOnboardingDismissed,
  memoryCenterTabFromPath,
  shouldShowMemoryOnboarding
} from '../memory-center-tab.util'

describe('memoryCenterTabFromPath', () => {
  it('defaults /memory to vectors and keeps explicit graph paths', () => {
    expect(memoryCenterTabFromPath('/memory')).toBe('vectors')
    expect(memoryCenterTabFromPath('/memory/')).toBe('vectors')
    expect(memoryCenterTabFromPath('/memory/graph')).toBe('graph')
  })

  it('maps /memory/vectors to vectors', () => {
    expect(memoryCenterTabFromPath('/memory/vectors')).toBe('vectors')
  })

  it('falls back to vectors for unknown segments', () => {
    expect(memoryCenterTabFromPath('/memory/unknown')).toBe('vectors')
    expect(memoryCenterTabFromPath('/elsewhere')).toBe('vectors')
  })
})

describe('shouldShowMemoryOnboarding', () => {
  it('hides when embedding is configured and both backlogs are empty', () => {
    expect(
      shouldShowMemoryOnboarding({
        dismissed: false,
        embeddingConfigured: true,
        unindexedDiaryCount: 0,
        pendingGraphCount: 0
      })
    ).toBe(false)
  })

  it('hides when dismissed even if setup is incomplete', () => {
    expect(
      shouldShowMemoryOnboarding({
        dismissed: true,
        embeddingConfigured: false,
        unindexedDiaryCount: 3,
        pendingGraphCount: 1
      })
    ).toBe(false)
  })
})

describe('persistMemoryOnboardingDismissed', () => {
  it('writes the fixed localStorage key', () => {
    localStorage.removeItem(MEMORY_ONBOARDING_DISMISSED_KEY)
    persistMemoryOnboardingDismissed()
    expect(MEMORY_ONBOARDING_DISMISSED_KEY).toBe('baishou.memory.onboardingDismissed.v1')
    expect(localStorage.getItem(MEMORY_ONBOARDING_DISMISSED_KEY)).toBe('1')
  })
})
