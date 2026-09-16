import { describe, expect, it } from 'vitest'
import {
  buildMemoryOnboardingModel,
  memoryCenterTabFromPath,
  resolveMemoryOrganizeAction,
  shouldShowMemoryOnboarding
} from '../memory-center-tab.util'

describe('memoryCenterTabFromPath', () => {
  it('should default to vectors when path is the memory root', () => {
    expect(memoryCenterTabFromPath('/memory')).toBe('vectors')
  })

  it('should read graph tab from path', () => {
    expect(memoryCenterTabFromPath('/memory/graph')).toBe('graph')
  })
})

describe('shouldShowMemoryOnboarding', () => {
  it('should hide when dismissed', () => {
    expect(
      shouldShowMemoryOnboarding({
        dismissed: true,
        embeddingConfigured: false,
        pendingEmbedCount: 3,
        pendingGraphCount: 1
      })
    ).toBe(false)
  })

  it('should show when embedding is missing', () => {
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

describe('buildMemoryOnboardingModel', () => {
  it('should block later steps when embedding is missing', () => {
    const model = buildMemoryOnboardingModel({
      embeddingConfigured: false,
      pendingEmbedCount: 2,
      pendingGraphCount: 1
    })
    expect(model.primaryKind).toBe('configure')
    expect(model.steps[1]?.status).toBe('blocked')
  })
})

describe('resolveMemoryOrganizeAction', () => {
  it('should send user to configure when embedding is missing', () => {
    expect(resolveMemoryOrganizeAction({ embeddingConfigured: false, pendingEmbedCount: 2 })).toBe(
      'configure'
    )
  })
})
