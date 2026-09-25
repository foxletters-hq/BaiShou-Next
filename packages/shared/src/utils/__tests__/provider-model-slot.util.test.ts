import { describe, expect, it } from 'vitest'
import {
  buildVisionLanguageSlots,
  resolveProviderModelSlot
} from '../provider-model-slot.util'

const official = { id: 'official', isEnabled: true }
const other = { id: 'other', isEnabled: true }

describe('resolveProviderModelSlot', () => {
  it('should use the first complete slot when a later slot points at another provider', () => {
    const hit = resolveProviderModelSlot([official, other], [
      { providerId: 'official', modelId: 'dialogue-model' },
      { providerId: 'other', modelId: 'summary-model' }
    ])
    expect(hit).toEqual({
      provider: official,
      providerId: 'official',
      modelId: 'dialogue-model'
    })
  })

  it('should skip an empty slot and use the next complete pair', () => {
    const hit = resolveProviderModelSlot([official, other], [
      { providerId: '', modelId: '' },
      { providerId: 'official', modelId: 'dialogue-model' },
      { providerId: 'other', modelId: 'summary-model' }
    ])
    expect(hit?.providerId).toBe('official')
    expect(hit?.modelId).toBe('dialogue-model')
  })

  it('should stop when the selected provider is missing instead of using another provider', () => {
    const hit = resolveProviderModelSlot([other], [
      { providerId: 'official', modelId: 'dialogue-model' },
      { providerId: 'other', modelId: 'summary-model' }
    ])
    expect(hit).toBeNull()
  })

  it('should stop when only the model id is set instead of borrowing the next provider', () => {
    const hit = resolveProviderModelSlot([official, other], [
      { providerId: '', modelId: 'vision-model' },
      { providerId: 'other', modelId: 'summary-model' }
    ])
    expect(hit).toBeNull()
  })
})

describe('buildVisionLanguageSlots', () => {
  it('should omit an override that does not include both provider and model', () => {
    const slots = buildVisionLanguageSlots({
      overrideModelId: 'only-model',
      visionProviderId: 'official',
      visionModelId: 'vision-model'
    })
    expect(slots).toEqual([{ providerId: 'official', modelId: 'vision-model' }])
  })

  it('should not include dialogue or summary slots', () => {
    const slots = buildVisionLanguageSlots({
      visionProviderId: '',
      visionModelId: ''
    })
    expect(slots).toEqual([{ providerId: '', modelId: '' }])
  })
})
