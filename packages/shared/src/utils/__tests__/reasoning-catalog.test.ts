import { afterEach, describe, expect, it } from 'vitest'
import { REASONING_MODELS_SNAPSHOT } from '../reasoning-models.snapshot'
import { extractReasoningCatalogFromModelsDevApi } from '../reasoning-catalog-extract'
import { getReasoningOverlayControl } from '../reasoning-catalog.overlay'
import {
  applyReasoningCatalogPayload,
  lookupReasoningCatalogControl,
  mapReasoningCatalogRecordToControl,
  resetReasoningCatalogForTests,
  setReasoningCatalogSnapshotForTest
} from '../reasoning-catalog-store'
import { getReasoningControlForModel, isDeepSeekV4Model } from '../reasoning-effort'

describe('reasoning-catalog', () => {
  afterEach(() => {
    resetReasoningCatalogForTests()
  })

  it('should overlay DeepSeek Flash short names when catalog misses them', () => {
    expect(getReasoningOverlayControl('deepseek-flash')?.efforts).toEqual([
      'low',
      'medium',
      'high',
      'max'
    ])
    expect(getReasoningOverlayControl('deepseek-flash-exp')?.efforts).toEqual([
      'low',
      'medium',
      'high',
      'max'
    ])
    expect(getReasoningOverlayControl('deepseek-reasoner')).toBeNull()
  })

  it('should extract only effort options from a models.dev-shaped payload', () => {
    const payload = extractReasoningCatalogFromModelsDevApi(
      {
        deepseek: {
          models: {
            'deepseek-flash': {
              reasoning: true,
              reasoning_options: [
                { type: 'toggle' },
                { type: 'effort', values: ['low', 'high', 'max', 'nope'] }
              ]
            },
            'deepseek-chat': {
              reasoning: true,
              reasoning_options: [{ type: 'toggle' }]
            }
          }
        }
      },
      { providerIdMap: { deepseek: 'deepseek' }, onlyMappedProviders: true }
    )

    expect(payload.byModelId['deepseek-flash']?.values).toEqual(['low', 'high', 'max', 'nope'])
    expect(payload.byProvider.deepseek?.['deepseek-flash']).toEqual(
      payload.byModelId['deepseek-flash']
    )
    expect(payload.byModelId['deepseek-chat']).toBeUndefined()
  })

  it('should drop unknown effort ids when mapping catalog records', () => {
    expect(mapReasoningCatalogRecordToControl({ values: ['low', 'nope', 'max'] })?.efforts).toEqual(
      ['low', 'max']
    )
    expect(mapReasoningCatalogRecordToControl({ values: ['nope'] })).toBeNull()
  })

  it('should prefer runtime catalog over snapshot and overlay over both', () => {
    setReasoningCatalogSnapshotForTest({
      byProvider: {},
      byModelId: {
        'gpt-5-unreal': { values: ['low'] }
      }
    })
    expect(lookupReasoningCatalogControl('gpt-5-unreal')?.efforts).toEqual(['low'])

    applyReasoningCatalogPayload({
      byProvider: {},
      byModelId: {
        'gpt-5-unreal': { values: ['high', 'max'] }
      }
    })
    expect(lookupReasoningCatalogControl('gpt-5-unreal')?.efforts).toEqual(['high', 'max'])

    const control = getReasoningControlForModel('deepseek-flash', 'deepseek')
    expect(control.mode).toBe('effort')
    expect(control.efforts).toEqual(['low', 'medium', 'high', 'max'])
  })

  it('should use catalog effort for unlisted models and skip blacklisted families', () => {
    applyReasoningCatalogPayload({
      byProvider: {},
      byModelId: {
        'cool-reasoner': { values: ['low', 'max'] },
        'qwen-plus': { values: ['low', 'high'] }
      }
    })

    expect(getReasoningControlForModel('cool-reasoner', 'custom').efforts).toEqual(['low', 'max'])
    expect(getReasoningControlForModel('qwen-plus', 'dashscope').mode).toBe('toggle')
    expect(getReasoningControlForModel('qwen-plus', 'openai').mode).toBe('none')
  })

  it('should treat official Flash short name as DeepSeek V4 transport family', () => {
    expect(isDeepSeekV4Model('deepseek-flash')).toBe(true)
    expect(isDeepSeekV4Model('deepseek-v4.1-flash')).toBe(true)
    expect(isDeepSeekV4Model('deepseek-reasoner')).toBe(false)
  })

  it('should keep official DeepSeek Flash in the generated snapshot', () => {
    expect(REASONING_MODELS_SNAPSHOT.byModelId['deepseek-flash']?.values).toEqual(
      expect.arrayContaining(['low', 'high', 'max'])
    )
  })
})
