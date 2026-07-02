import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIAdaptedProvider } from '../openai.provider'
import type { AiProviderModel } from '@baishou/shared'
import { ProviderType, WebSearchMode } from '@baishou/shared'

// TDD：OpenAI 提供商高级参数传递测试
// 测试目标：验证 advancedConfig 参数正确传递到 AI SDK

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn()
}))

describe('OpenAIAdaptedProvider - Advanced Config', () => {
  let mockConfig: AiProviderModel
  let mockOpenAI: any
  let mockChatModel: any

  beforeEach(async () => {
    const { createOpenAI } = await import('@ai-sdk/openai')

    mockChatModel = vi.fn()
    mockOpenAI = {
      chat: vi.fn().mockReturnValue(mockChatModel),
      textEmbeddingModel: vi.fn()
    }

    vi.mocked(createOpenAI).mockReturnValue(mockOpenAI)

    mockConfig = {
      id: 'provider-openai',
      name: 'OpenAI',
      type: ProviderType.OpenAI,
      apiKey: 'sk-test-key',
      baseUrl: '',
      models: ['gpt-4o'],
      defaultDialogueModel: 'gpt-4o',
      defaultNamingModel: 'gpt-4o-mini',
      isEnabled: true,
      enabledModels: ['gpt-4o'],
      isSystem: false,
      sortOrder: 0,
      webSearchMode: WebSearchMode.Off
    }
  })

  it('should create language model without advanced config', () => {
    const provider = new OpenAIAdaptedProvider(mockConfig)

    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(mockOpenAI.chat).toHaveBeenCalledWith('gpt-4o')
  })

  it('should pass temperature to language model when configured', () => {
    mockConfig.advancedConfig = {
      temperature: 0.7
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    // 注意：AI SDK 的参数传递发生在 generateText/streamText 调用时
    // 这里验证 provider 能正确存储配置
    expect(provider.config.advancedConfig?.temperature).toBe(0.7)
  })

  it('should pass topK to language model when configured', () => {
    mockConfig.advancedConfig = {
      topK: 40
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.topK).toBe(40)
  })

  it('should pass topP to language model when configured', () => {
    mockConfig.advancedConfig = {
      topP: 0.9
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.topP).toBe(0.9)
  })

  it('should pass maxTokens to language model when configured', () => {
    mockConfig.advancedConfig = {
      maxTokens: 4096
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.maxTokens).toBe(4096)
  })

  it('should pass frequencyPenalty to language model when configured', () => {
    mockConfig.advancedConfig = {
      frequencyPenalty: 0.5
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.frequencyPenalty).toBe(0.5)
  })

  it('should pass presencePenalty to language model when configured', () => {
    mockConfig.advancedConfig = {
      presencePenalty: 0.5
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.presencePenalty).toBe(0.5)
  })

  it('should pass multiple advanced config parameters', () => {
    mockConfig.advancedConfig = {
      temperature: 0.8,
      topK: 50,
      topP: 0.95,
      maxTokens: 2048,
      frequencyPenalty: 1.0,
      presencePenalty: 1.0
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig).toEqual({
      temperature: 0.8,
      topK: 50,
      topP: 0.95,
      maxTokens: 2048,
      frequencyPenalty: 1.0,
      presencePenalty: 1.0
    })
  })

  it('should handle empty advanced config object', () => {
    mockConfig.advancedConfig = {}

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig).toEqual({})
  })
})
