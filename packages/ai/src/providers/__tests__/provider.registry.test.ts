import { describe, it, expect, beforeEach } from 'vitest'
import { ProviderType, type AIProviderConfig } from '@baishou/shared'
// 注意：以下类型还在实现过程中，我们遵循 TDD 先测试再跑码
import { AIProviderRegistry } from '../provider.registry'

describe('AIProviderRegistry', () => {
  let registry: AIProviderRegistry

  beforeEach(() => {
    // 假设 registry 是个纯类的单例模式或可以重置的数据中心
    registry = AIProviderRegistry.getInstance()
    registry.clearProviders()
    registry.initializeDefaultProviders()
  })

  it('should initialize with built-in providers', () => {
    const providers = registry.listProviders()
    expect(providers.length).toBeGreaterThanOrEqual(13) // 内置13种

    const gemini = registry.getProvider('gemini')
    expect(gemini).toBeDefined()
    expect(gemini?.config.type).toBe(ProviderType.Gemini)
  })

  it('should allow removing a provider by id', () => {
    expect(registry.hasProvider('openai')).toBe(true)
    registry.removeProvider('openai')
    expect(registry.hasProvider('openai')).toBe(false)
  })

  it('should reuse the same instance when provider config is unchanged', () => {
    const config: AIProviderConfig = {
      id: 'siliconflow',
      name: 'siliconflow',
      type: ProviderType.SiliconFlow,
      apiKey: 'sk-test',
      baseUrl: 'https://example.test',
      models: [],
      enabledModels: [],
      defaultDialogueModel: '',
      defaultNamingModel: '',
      isEnabled: true,
      isSystem: false,
      sortOrder: 0
    }
    const first = registry.getOrUpdateProvider(config)
    const second = registry.getOrUpdateProvider({ ...config, models: [] })
    expect(second).toBe(first)
  })

  it('should rebuild when api key or base url changes', () => {
    const config: AIProviderConfig = {
      id: 'siliconflow',
      name: 'siliconflow',
      type: ProviderType.SiliconFlow,
      apiKey: 'sk-old',
      baseUrl: 'https://example.test',
      models: [],
      enabledModels: [],
      defaultDialogueModel: '',
      defaultNamingModel: '',
      isEnabled: true,
      isSystem: false,
      sortOrder: 0
    }
    const first = registry.getOrUpdateProvider(config)
    const second = registry.getOrUpdateProvider({ ...config, apiKey: 'sk-new' })
    expect(second).not.toBe(first)
  })
})
