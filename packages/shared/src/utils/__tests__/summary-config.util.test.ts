import { describe, expect, it } from 'vitest'
import type { AIProviderConfig } from '../../types/settings.types'
import { resolveSummaryConfigFromSettings } from '../summary-config.util'

function makeProvider(id: string, overrides: Partial<AIProviderConfig> = {}): AIProviderConfig {
  return {
    id,
    name: id,
    type: id as AIProviderConfig['type'],
    apiKey: '',
    baseUrl: `https://${id}.example/v1`,
    models: ['model-a'],
    enabledModels: ['model-a'],
    defaultDialogueModel: '',
    defaultNamingModel: '',
    isEnabled: true,
    isSystem: true,
    sortOrder: 0,
    ...overrides
  }
}

describe('resolveSummaryConfigFromSettings', () => {
  it('uses configured summary provider and model when both are valid', () => {
    const providers = [
      makeProvider('deepseek', { apiKey: 'sk-deep', enabledModels: ['deepseek-chat'] }),
      makeProvider('gemini', { apiKey: 'sk-gem', enabledModels: ['gemini-pro'] })
    ]

    const result = resolveSummaryConfigFromSettings(providers, {
      globalSummaryProviderId: 'deepseek',
      globalSummaryModelId: 'deepseek-chat',
      globalDialogueProviderId: 'gemini',
      globalDialogueModelId: 'gemini-pro'
    })

    expect(result).toEqual({
      ok: true,
      providerConfig: providers[0],
      modelId: 'deepseek-chat',
      isFallback: false
    })
  })

  it('does not use the dialogue model when the summary slot is off', () => {
    const providers = [
      makeProvider('gemini', { apiKey: 'expired-gem', enabledModels: ['gemini-pro'] }),
      makeProvider('deepseek', { apiKey: 'sk-deep', enabledModels: ['deepseek-chat'] })
    ]

    const result = resolveSummaryConfigFromSettings(providers, {
      globalSummaryProviderId: 'gemini',
      globalSummaryModelId: 'off',
      globalDialogueProviderId: 'deepseek',
      globalDialogueModelId: 'deepseek-chat'
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('no_model')
  })

  it('does not treat a placeholder summary provider as a reason to use dialogue', () => {
    const providers = [
      makeProvider('deepseek', { apiKey: 'sk-deep', enabledModels: ['deepseek-chat'] })
    ]

    const result = resolveSummaryConfigFromSettings(providers, {
      globalSummaryProviderId: 'gemini',
      globalSummaryModelId: 'off',
      globalDialogueProviderId: 'deepseek',
      globalDialogueModelId: 'deepseek-chat'
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('no_model')
  })

  it('reports missing api key when no usable pair exists', () => {
    const providers = [makeProvider('gemini', { apiKey: '', enabledModels: ['gemini-pro'] })]

    const result = resolveSummaryConfigFromSettings(providers, {
      globalSummaryProviderId: 'gemini',
      globalSummaryModelId: 'off',
      globalDialogueProviderId: 'gemini',
      globalDialogueModelId: 'off'
    })

    expect(result).toEqual({
      ok: false,
      reason: 'no_api_key',
      providerName: 'gemini'
    })
  })
})
