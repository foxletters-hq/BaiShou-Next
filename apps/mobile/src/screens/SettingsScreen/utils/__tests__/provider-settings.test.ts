import { describe, expect, it } from 'vitest'
import type { AIProviderConfig } from '@baishou/shared'
import { isValidProviderId } from '../provider-settings'

describe('isValidProviderId', () => {
  it('accepts built-in providers even when not saved yet', () => {
    expect(isValidProviderId('openai', [])).toBe(true)
    expect(isValidProviderId('gemini', [])).toBe(true)
    expect(isValidProviderId('deepseek', [])).toBe(true)
  })

  it('accepts saved custom providers', () => {
    const saved: AIProviderConfig[] = [
      {
        id: 'custom_123',
        name: 'My API',
        type: 'openai',
        apiKey: '',
        baseUrl: 'https://example.com/v1',
        models: [],
        enabledModels: [],
        isEnabled: true,
        isSystem: false,
        sortOrder: 0,
        defaultDialogueModel: '',
        defaultNamingModel: ''
      }
    ]
    expect(isValidProviderId('custom_123', saved)).toBe(true)
  })

  it('rejects unknown provider ids', () => {
    expect(isValidProviderId('not-a-provider', [])).toBe(false)
    expect(isValidProviderId('custom_missing', [])).toBe(false)
  })
})
