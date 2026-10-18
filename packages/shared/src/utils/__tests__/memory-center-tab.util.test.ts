import { describe, expect, it } from 'vitest'
import {
  buildMemoryOnboardingModel,
  memoryCenterTabFromPath,
  resolveMemoryOrganizeAction,
  resolveMemoryOrganizeConfigurePrompt,
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

  it('should send user to configure when graph extract model is missing', () => {
    expect(
      resolveMemoryOrganizeAction({
        embeddingConfigured: true,
        extractConfigured: false,
        pendingEmbedCount: 2
      })
    ).toBe('configure')
  })

  it('should keep embedding-then-graph when extractConfigured is omitted', () => {
    expect(resolveMemoryOrganizeAction({ embeddingConfigured: true, pendingEmbedCount: 2 })).toBe(
      'embed-then-graph'
    )
  })
})

describe('resolveMemoryOrganizeConfigurePrompt', () => {
  it('should name both models when neither slot is ready', () => {
    expect(
      resolveMemoryOrganizeConfigurePrompt({
        embeddingConfigured: false,
        extractConfigured: false
      })
    ).toEqual({ toastKey: 'memory.need_models_to_organize', picker: 'embedding' })
  })

  it('should open the extract picker when only the graph model is missing', () => {
    expect(
      resolveMemoryOrganizeConfigurePrompt({
        embeddingConfigured: true,
        extractConfigured: false
      })
    ).toEqual({ toastKey: 'memory.need_extract_to_organize', picker: 'extract' })
  })

  it('should open the embedding picker when only the embedding model is missing', () => {
    expect(
      resolveMemoryOrganizeConfigurePrompt({
        embeddingConfigured: false,
        extractConfigured: true
      })
    ).toEqual({ toastKey: 'memory.need_embedding_to_organize', picker: 'embedding' })
  })

  it('should return null when both models are ready', () => {
    expect(
      resolveMemoryOrganizeConfigurePrompt({
        embeddingConfigured: true,
        extractConfigured: true
      })
    ).toBeNull()
  })
})
