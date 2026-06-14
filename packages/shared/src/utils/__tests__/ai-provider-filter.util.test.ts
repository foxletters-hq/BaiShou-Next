import { describe, expect, it } from 'vitest'
import type { AIProviderConfig } from '../../types/settings.types'
import { ProviderType } from '../../types/ai-provider.types'
import { filterProvidersForModelSwitcher } from '../ai-provider-filter.util'

function provider(
  partial: Partial<AIProviderConfig> & Pick<AIProviderConfig, 'id'>
): AIProviderConfig {
  return {
    name: partial.id,
    type: ProviderType.OpenAI,
    apiKey: '',
    baseUrl: '',
    models: [],
    enabledModels: [],
    defaultDialogueModel: '',
    defaultNamingModel: '',
    isEnabled: true,
    isSystem: false,
    sortOrder: 0,
    ...partial
  }
}

describe('filterProvidersForModelSwitcher', () => {
  const providers = [
    provider({
      id: 'p1',
      models: ['gpt-4', 'text-embedding-3-small', 'tts-1'],
      enabledModels: ['gpt-4', 'text-embedding-3-small', 'tts-1']
    }),
    provider({
      id: 'p2',
      isEnabled: false,
      models: ['gpt-4'],
      enabledModels: ['gpt-4']
    })
  ]

  it('filters dialogue models', () => {
    const result = filterProvidersForModelSwitcher(providers, 'dialogue')
    expect(result).toHaveLength(1)
    expect(result[0]?.enabledModels).toEqual(['gpt-4'])
  })

  it('filters embedding models', () => {
    const result = filterProvidersForModelSwitcher(providers, 'embedding')
    expect(result[0]?.enabledModels).toEqual(['text-embedding-3-small'])
  })

  it('filters tts models', () => {
    const result = filterProvidersForModelSwitcher(providers, 'tts')
    expect(result[0]?.enabledModels).toEqual(['tts-1'])
  })

  it('excludes provider when enabledModels is explicitly empty', () => {
    const result = filterProvidersForModelSwitcher(
      [
        provider({
          id: 'google',
          models: ['gemini-2.5-pro', 'gemini-2.0-flash'],
          enabledModels: []
        })
      ],
      'dialogue'
    )
    expect(result).toHaveLength(0)
  })

  it('falls back to models when enabledModels field is missing (legacy)', () => {
    const legacy = provider({
      id: 'legacy',
      models: ['gpt-4', 'text-embedding-3-small']
    })
    delete (legacy as { enabledModels?: string[] }).enabledModels

    const result = filterProvidersForModelSwitcher([legacy], 'dialogue')
    expect(result).toHaveLength(1)
    expect(result[0]?.enabledModels).toEqual(['gpt-4'])
  })
})
