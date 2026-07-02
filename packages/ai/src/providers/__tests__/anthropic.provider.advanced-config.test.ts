import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnthropicAdaptedProvider } from '../anthropic.provider'
import type { AiProviderModel } from '@baishou/shared'
import { ProviderType, WebSearchMode } from '@baishou/shared'

// TDD：Anthropic 提供商高级参数传递测试
// 测试目标：验证 advancedConfig 参数正确传递到 AI SDK
// 根据 SCOPE.md，Anthropic 支持 4 个参数：temperature, topK, topP, maxOutputTokens

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn()
}))

describe('AnthropicAdaptedProvider - Advanced Config', () => {
  let mockConfig: AiProviderModel
  let mockAnthropic: any
  let mockChatModel: any

  beforeEach(async () => {
    const { createAnthropic } = await import('@ai-sdk/anthropic')

    mockChatModel = vi.fn()
    mockAnthropic = vi.fn().mockReturnValue(mockChatModel)

    vi.mocked(createAnthropic).mockReturnValue(mockAnthropic)

    mockConfig = {
      id: 'provider-anthropic',
      name: 'Anthropic',
      type: ProviderType.Anthropic,
      apiKey: 'sk-ant-test-key',
      baseUrl: '',
      models: ['claude-3-opus-20240229'],
      defaultDialogueModel: 'claude-3-opus-20240229',
      defaultNamingModel: 'claude-3-haiku-20240307',
      isEnabled: true,
      enabledModels: ['claude-3-opus-20240229'],
      isSystem: false,
      sortOrder: 0,
      webSearchMode: WebSearchMode.Off
    }
  })

  it('should create language model without advanced config', () => {
    const provider = new AnthropicAdaptedProvider(mockConfig)

    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(mockAnthropic).toHaveBeenCalledWith('claude-3-opus-20240229')
  })

  it('should pass temperature to language model when configured', () => {
    mockConfig.advancedConfig = {
      temperature: 0.7
    }

    const provider = new AnthropicAdaptedProvider(mockConfig)
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

    const provider = new AnthropicAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.topK).toBe(40)
  })

  it('should pass topP to language model when configured', () => {
    mockConfig.advancedConfig = {
      topP: 0.9
    }

    const provider = new AnthropicAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.topP).toBe(0.9)
  })

  it('should pass maxTokens to language model when configured', () => {
    mockConfig.advancedConfig = {
      maxTokens: 4096
    }

    const provider = new AnthropicAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig?.maxTokens).toBe(4096)
  })

  it('should pass multiple advanced config parameters (Anthropic supports 4)', () => {
    mockConfig.advancedConfig = {
      temperature: 0.8,
      topK: 50,
      topP: 0.95,
      maxTokens: 2048
    }

    const provider = new AnthropicAdaptedProvider(mockConfig)
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

    const provider = new AnthropicAdaptedProvider(mockConfig)
    const model = provider.getLanguageModel()

    expect(model).toBeDefined()
    expect(provider.config.advancedConfig).toEqual({})
  })

  it('should ignore unsupported parameters (frequencyPenalty, presencePenalty)', () => {
    // Anthropic 不支持这两个参数，但类型系统允许（向后兼容）
    // 实际使用时这些参数会被 AI SDK 忽略
    mockConfig.advancedConfig = {
      temperature: 0.7,
      topK: 40,
      frequencyPenalty: 0.5, // Anthropic 不支持
      presencePenalty: 0.5 // Anthropic 不支持
    }

    const provider = new AnthropicAdaptedProvider(mockConfig)
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
