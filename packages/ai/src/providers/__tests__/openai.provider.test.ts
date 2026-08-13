import { describe, it, expect, vi } from 'vitest'
import { OpenAIAdaptedProvider } from '../openai.provider'
import { ProviderType, createAiProvider } from '@baishou/shared'
import * as openaiSdk from '@ai-sdk/openai'
import * as openaiCompatibleSdk from '@ai-sdk/openai-compatible'

vi.mock('@ai-sdk/openai', () => {
  const dummyModel = {}
  const dummyEmbedModel = {}
  const chatFn = vi.fn().mockReturnValue(dummyModel)
  const responsesFn = vi.fn().mockReturnValue(dummyModel)
  const mockProvider = {
    chat: chatFn,
    responses: responsesFn,
    textEmbeddingModel: vi.fn().mockReturnValue(dummyEmbedModel)
  }

  return {
    createOpenAI: vi.fn().mockReturnValue(mockProvider)
  }
})

vi.mock('@ai-sdk/openai-compatible', () => {
  const dummyModel = {}
  const dummyEmbedModel = {}
  const chatModelFn = vi.fn().mockReturnValue(dummyModel)
  const mockProvider = {
    chatModel: chatModelFn,
    textEmbeddingModel: vi.fn().mockReturnValue(dummyEmbedModel)
  }

  return {
    createOpenAICompatible: vi.fn().mockReturnValue(mockProvider)
  }
})

describe('OpenAIAdaptedProvider', () => {
  it('should use openai-compatible for DeepSeek chat', () => {
    const config = createAiProvider({
      id: ProviderType.DeepSeek,
      name: 'DeepSeek',
      type: ProviderType.DeepSeek,
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.com/v1'
    })

    const provider = new OpenAIAdaptedProvider(config)
    expect(provider.config.id).toBe(ProviderType.DeepSeek)

    provider.getLanguageModel()

    expect(openaiCompatibleSdk.createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'openaiCompatible',
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com/v1',
        fetch: expect.any(Function)
      })
    )
    expect(openaiSdk.createOpenAI).not.toHaveBeenCalled()
  })

  it('should use chat for non-reasoning models on official OpenAI', () => {
    const config = createAiProvider({
      id: ProviderType.OpenAI,
      name: 'OpenAI',
      type: ProviderType.OpenAI,
      defaultDialogueModel: 'gpt-4o'
    })

    const provider = new OpenAIAdaptedProvider(config)
    const model = provider.getLanguageModel()
    expect(model).toBeDefined()
    const mockProvider = vi.mocked(openaiSdk.createOpenAI).mock.results.at(-1)!.value
    expect(mockProvider.chat).toHaveBeenCalledWith('gpt-4o')
  })

  it('should use responses for OpenAI-style reasoning models', () => {
    vi.mocked(openaiSdk.createOpenAI).mockClear()
    const config = createAiProvider({
      id: ProviderType.OpenAI,
      name: 'OpenAI',
      type: ProviderType.OpenAI,
      defaultDialogueModel: 'gpt-5.6-sol'
    })

    const provider = new OpenAIAdaptedProvider(config)
    provider.getLanguageModel('gpt-5.6-sol')
    const mockProvider = vi.mocked(openaiSdk.createOpenAI).mock.results.at(-1)!.value
    expect(mockProvider.responses).toHaveBeenCalledWith('gpt-5.6-sol')
  })
})
