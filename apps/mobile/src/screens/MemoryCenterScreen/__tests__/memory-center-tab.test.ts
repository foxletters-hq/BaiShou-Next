import { describe, expect, it } from 'vitest'
import { memoryCenterTabFromPath, shouldShowMemoryOnboarding } from '@baishou/shared'

describe('mobile memory center tab', () => {
  it('should open vectors by default', () => {
    expect(memoryCenterTabFromPath('/memory')).toBe('vectors')
  })

  it('should keep onboarding visible until dismissed when embedding is missing', () => {
    expect(
      shouldShowMemoryOnboarding({
        dismissed: false,
        embeddingConfigured: false,
        pendingEmbedCount: 0,
        pendingGraphCount: 0
      })
    ).toBe(true)
  })
})
