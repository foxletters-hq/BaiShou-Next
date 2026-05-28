import { describe, expect, it } from 'vitest'
import {
  EmbeddingProviderConfigError,
  normalizeProviderConfig,
  patchProviderConfigInStore,
  providerRequiresApiKey,
  resolveProviderConfig
} from '../ai-provider-config.util'
import type { AIProviderConfig } from '@baishou/shared'

describe('ai-provider-config.util', () => {
  it('requires api key for cloud providers', () => {
    expect(providerRequiresApiKey('openai')).toBe(true)
    expect(providerRequiresApiKey('ollama')).toBe(false)
    expect(providerRequiresApiKey('lmstudio')).toBe(false)
  })

  it('throws when embedding provider has no api key', () => {
    const providers: AIProviderConfig[] = [
      {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai' as any,
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        models: [],
        enabledModels: ['text-embedding-3-small'],
        defaultDialogueModel: '',
        defaultNamingModel: '',
        isEnabled: true,
        isSystem: true,
        sortOrder: 0
      }
    ]

    expect(() => resolveProviderConfig(providers, 'openai')).toThrow(EmbeddingProviderConfigError)
    try {
      resolveProviderConfig(providers, 'openai')
    } catch (e) {
      expect((e as EmbeddingProviderConfigError).code).toBe('api_key_missing')
    }
  })

  it('normalizes provider config for runtime', () => {
    const normalized = normalizeProviderConfig({
      id: 'openai',
      name: 'OpenAI',
      type: 'openai' as any,
      apiKey: '  sk-test  ',
      baseUrl: ' https://proxy.example/v1 ',
      models: [],
      enabledModels: [],
      defaultDialogueModel: '',
      defaultNamingModel: '',
      isEnabled: true,
      isSystem: true,
      sortOrder: 0
    })

    expect(normalized.apiKey).toBe('sk-test')
    expect(normalized.baseUrl).toBe('https://proxy.example/v1')
  })

  it('patchProviderConfigInStore merges updates without clearing stored api key', () => {
    const providers: AIProviderConfig[] = [
      {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai' as any,
        apiKey: 'sk-existing',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4'],
        enabledModels: ['gpt-4'],
        defaultDialogueModel: '',
        defaultNamingModel: '',
        isEnabled: true,
        isSystem: true,
        sortOrder: 0
      }
    ]

    const { providers: next, provider } = patchProviderConfigInStore(providers, 'openai', {
      apiKey: '   ',
      models: ['gpt-4', 'gpt-4o']
    })

    expect(Array.isArray(next)).toBe(true)
    expect(next).toHaveLength(1)
    expect(provider.apiKey).toBe('sk-existing')
    expect(provider.models).toEqual(['gpt-4', 'gpt-4o'])
  })
})
