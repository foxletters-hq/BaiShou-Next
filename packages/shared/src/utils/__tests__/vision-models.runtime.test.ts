import { afterEach, describe, expect, it } from 'vitest'
import { isVisionModel } from '../model-capabilities'
import {
  applyVisionModelsRuntimeOverlay,
  extractVisionModelIdsFromModelsDev,
  isVisionModelInRuntime,
  resetVisionModelsRuntimeOverlayForTests
} from '../vision-models.runtime'

describe('extractVisionModelIdsFromModelsDev', () => {
  it('keeps image-input chat models and drops image-generation ids', () => {
    const ids = extractVisionModelIdsFromModelsDev({
      openai: {
        models: {
          'gpt-6-luna': { modalities: { input: ['text', 'image'] } },
          'gpt-image-1': { modalities: { input: ['text', 'image'] } }
        }
      },
      anthropic: {
        models: {
          'claude-haiku-5-5': { modalities: { input: ['text', 'image', 'pdf'] } },
          'claude-text-only': { modalities: { input: ['text'] } }
        }
      }
    })

    expect(ids).toEqual(['claude-haiku-5-5', 'gpt-6-luna'])
  })
})

describe('vision runtime overlay', () => {
  afterEach(() => {
    resetVisionModelsRuntimeOverlayForTests()
  })

  it('marks overlay models as vision before snapshot/regex', () => {
    expect(isVisionModelInRuntime('brand-new-vision-model')).toBeUndefined()
    applyVisionModelsRuntimeOverlay(['brand-new-vision-model'])
    expect(isVisionModelInRuntime('openai/brand-new-vision-model')).toBe(true)
    expect(isVisionModel('brand-new-vision-model', 'openai')).toBe(true)
  })
})
