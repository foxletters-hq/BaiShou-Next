import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIAdaptedProvider } from '../openai.provider'
import type { AiProviderModel } from '@baishou/shared'
import { ProviderType, WebSearchMode } from '@baishou/shared'

// TDD：Ollama 提供商高级参数传递测试
// 测试目标：验证 advancedConfig 参数正确传递到 AI SDK
// 根据 SCOPE.md，Ollama 支持 4 个参数：temperature, topK, topP, repetition_penalty
// 注意：Ollama 不支持 maxTokens（没有该参数）

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn()
}))

describe('Ollama Provider (OpenAI-compatible) - Advanced Config', () => {
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

    // Ollama 配置（本地部署，无需 API Key）
    mockConfig = {
      id: 'provider-ollama',
      name: 'Ollama',
      type: ProviderType.Ollama,
      apiKey: '', // Ollama 本地部署通常无需 API Key
      baseUrl: 'http://localhost:11434/v1',
      models: ['llama3.2', 'qwen2.5'],
      defaultDialogueModel: 'llama3.2',
      defaultNamingModel: 'llama3.2',
      isEnabled: true,
      enabledModels: ['llama3.2'],
      isSystem: false,
      sortOrder: 0,
      webSearchMode: WebSearchMode.Off
    }
  })

  it('should create language model without advanced config', () => {
    const provider = new OpenAIAdaptedProvider(mockConfig)

    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(mockOpenAI.chat).toHaveBeenCalledWith('llama3.2')
  })

  it('should pass temperature to language model when configured', () => {
    mockConfig.advancedConfig = {
      temperature: 0.7
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
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

  it('should pass frequencyPenalty (mapped to repetition_penalty in Ollama)', () => {
    // Ollama 使用 repetition_penalty，我们用 frequencyPenalty 存储
    mockConfig.advancedConfig = {
      frequencyPenalty: 1.1
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.frequencyPenalty).toBe(1.1)
  })

  it('should pass multiple supported parameters (Ollama supports 4)', () => {
    mockConfig.advancedConfig = {
      temperature: 0.8,
      topK: 50,
      topP: 0.95,
      frequencyPenalty: 1.1 // repetition_penalty
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig).toEqual({
      temperature: 0.8,
      topK: 50,
      topP: 0.95,
      frequencyPenalty: 1.1
    })
  })

  it('should handle empty advanced config object', () => {
    mockConfig.advancedConfig = {}

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig).toEqual({})
  })

  it('should ignore unsupported parameters (maxTokens, presencePenalty)', () => {
    // Ollama 不支持 maxTokens（没有该参数）和 presencePenalty
    mockConfig.advancedConfig = {
      temperature: 0.7,
      topK: 40,
      maxTokens: 4096, // Ollama 不支持
      presencePenalty: 0.5 // Ollama 不支持
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    // 配置存储完整，但 AI SDK 调用时会忽略不支持的参数
    expect(provider.config.advancedConfig).toEqual({
      temperature: 0.7,
      topK: 40,
      maxTokens: 4096,
      presencePenalty: 0.5
    })
  })

  it('should work with different Ollama models', () => {
    mockConfig.advancedConfig = {
      temperature: 0.5,
      topP: 0.8
    }

    const provider = new OpenAIAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel('qwen2.5')

    expect(model).toBeDefined()
    expect(mockOpenAI.chat).toHaveBeenCalledWith('qwen2.5')
    expect(provider.config.advancedConfig?.temperature).toBe(0.5)
    expect(provider.config.advancedConfig?.topP).toBe(0.8)
  })
})
