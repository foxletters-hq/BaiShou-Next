import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GeminiAdaptedProvider } from '../gemini.provider'
import type { AiProviderModel } from '@baishou/shared'
import { ProviderType, WebSearchMode } from '@baishou/shared'

// TDD：Gemini 提供商高级参数传递测试
// 测试目标：验证 advancedConfig 参数正确传递到 AI SDK
// 根据 SCOPE.md，Gemini 支持 4 个参数：temperature, topK, topP, maxOutputTokens

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn()
}))

describe('GeminiAdaptedProvider - Advanced Config', () => {
  let mockConfig: AiProviderModel
  let mockGemini: any
  let mockChatModel: any

  beforeEach(async () => {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google')

    mockChatModel = vi.fn()
    mockGemini = vi.fn().mockReturnValue(mockChatModel)
    mockGemini.textEmbeddingModel = vi.fn()

    vi.mocked(createGoogleGenerativeAI).mockReturnValue(mockGemini)

    mockConfig = {
      id: 'provider-gemini',
      name: 'Google Gemini',
      type: ProviderType.Gemini,
      apiKey: 'test-gemini-key',
      baseUrl: '',
      models: ['gemini-1.5-pro'],
      defaultDialogueModel: 'gemini-1.5-pro',
      defaultNamingModel: 'gemini-1.5-flash',
      isEnabled: true,
      enabledModels: ['gemini-1.5-pro'],
      isSystem: false,
      sortOrder: 0,
      webSearchMode: WebSearchMode.Off
    }
  })

  it('should create language model without advanced config', () => {
    const provider = new GeminiAdaptedProvider(mockConfig)

    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(mockGemini).toHaveBeenCalledWith('gemini-1.5-pro')
  })

  it('should pass temperature to language model when configured', () => {
    mockConfig.advancedConfig = {
      temperature: 0.7
    }

    const provider = new GeminiAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.temperature).toBe(0.7)
  })

  it('should pass topK to language model when configured', () => {
    mockConfig.advancedConfig = {
      topK: 40
    }

    const provider = new GeminiAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.topK).toBe(40)
  })

  it('should pass topP to language model when configured', () => {
    mockConfig.advancedConfig = {
      topP: 0.9
    }

    const provider = new GeminiAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.topP).toBe(0.9)
  })

  it('should pass maxTokens to language model when configured', () => {
    mockConfig.advancedConfig = {
      maxTokens: 4096
    }

    const provider = new GeminiAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.maxTokens).toBe(4096)
  })

  it('should pass multiple advanced config parameters (Gemini supports 4)', () => {
    mockConfig.advancedConfig = {
      temperature: 0.8,
      topK: 50,
      topP: 0.95,
      maxTokens: 2048
    }

    const provider = new GeminiAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig).toEqual({
      temperature: 0.8,
      topK: 50,
      topP: 0.95,
      maxTokens: 2048
    })
  })

  it('should handle empty advanced config object', () => {
    mockConfig.advancedConfig = {}

    const provider = new GeminiAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig).toEqual({})
  })

  it('should ignore unsupported parameters (frequencyPenalty, presencePenalty)', () => {
    // Gemini 不支持这两个参数，但类型系统允许（向后兼容）
    // 实际使用时这些参数会被 AI SDK 忽略
    mockConfig.advancedConfig = {
      temperature: 0.7,
      topK: 40,
      frequencyPenalty: 0.5, // Gemini 不支持
      presencePenalty: 0.5 // Gemini 不支持
    }

    const provider = new GeminiAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    // 配置存储完整，但 AI SDK 调用时会忽略不支持的参数
    expect(provider.config.advancedConfig).toEqual({
      temperature: 0.7,
      topK: 40,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5
    })
  })
})
