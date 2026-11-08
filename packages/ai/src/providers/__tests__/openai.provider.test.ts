import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIAdaptedProvider } from '../openai.provider'
import { ProviderType, createAiProvider } from '@baishou/shared'
import * as openaiSdk from '@ai-sdk/openai'
import * as openaiCompatibleSdk from '@ai-sdk/openai-compatible'

globalThis.fetch = vi.fn()

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('uses openai-compatible SDK for embeddings on compatible gateways', () => {
    vi.mocked(openaiSdk.createOpenAI).mockClear()
    vi.mocked(openaiCompatibleSdk.createOpenAICompatible).mockClear()
    const config = createAiProvider({
      id: ProviderType.DeepSeek,
      name: 'DeepSeek',
      type: ProviderType.DeepSeek,
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.com/v1'
    })

    const provider = new OpenAIAdaptedProvider(config)
    provider.getEmbeddingModel('Qwen/Qwen3-Embedding-4B')

    expect(openaiCompatibleSdk.createOpenAICompatible).toHaveBeenCalled()
    const mockProvider = vi
      .mocked(openaiCompatibleSdk.createOpenAICompatible)
      .mock.results.at(-1)!.value
    expect(mockProvider.textEmbeddingModel).toHaveBeenCalledWith('Qwen/Qwen3-Embedding-4B')
    expect(openaiSdk.createOpenAI).not.toHaveBeenCalled()
  })

  describe('fetchAvailableModels', () => {
    it('merges zhipu known embedding models when API omits them', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'glm-4' }, { id: 'glm-4-flash' }]
        })
      } as Response)

      const provider = new OpenAIAdaptedProvider(
        createAiProvider({
          id: ProviderType.Zhipu,
          name: 'ZhiPu',
          type: ProviderType.Zhipu,
          apiKey: 'test-key',
          baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
        })
      )

      const models = await provider.fetchAvailableModels()
      expect(models).toEqual(['glm-4', 'glm-4-flash', 'embedding-2', 'embedding-3'])
      expect(fetch).toHaveBeenCalledWith(
        'https://open.bigmodel.cn/api/paas/v4/models',
        expect.any(Object)
      )
    })

    it('does not inject zhipu embedding seeds for other providers', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'gpt-4o' }]
        })
      } as Response)

      const provider = new OpenAIAdaptedProvider(
        createAiProvider({
          id: ProviderType.OpenAI,
          name: 'OpenAI',
          type: ProviderType.OpenAI,
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1'
        })
      )

      const models = await provider.fetchAvailableModels()
      expect(models).toEqual(['gpt-4o'])
    })

    it('strips jina-ai/ prefix from fetched models list', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'jina-ai/jina-embeddings-v3' },
            { id: 'jina-ai/jina-clip-v2' },
            { id: 'jina-ai/reader-lm-1.5b' }
          ]
        })
      } as Response)

      const provider = new OpenAIAdaptedProvider(
        createAiProvider({
          id: 'jina',
          name: 'Jina AI',
          type: ProviderType.Custom,
          apiKey: 'test-key',
          baseUrl: 'https://api.jina.ai/v1'
        })
      )

      const models = await provider.fetchAvailableModels()
      expect(models).toEqual(['jina-embeddings-v3', 'jina-clip-v2', 'reader-lm-1.5b'])
    })

    it('fetches models from ollama with root url and falls back to /api/tags on 404', async () => {
      // 第一次请求 /v1/models 返回 404
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response)
      // 第二次请求 /api/tags 成功返回 Ollama 原生 models 格式
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'bge-m3:latest', model: 'bge-m3:latest' },
            { name: 'llama3:latest', model: 'llama3:latest' }
          ]
        })
      } as Response)

      const provider = new OpenAIAdaptedProvider(
        createAiProvider({
          id: ProviderType.Ollama,
          name: 'Ollama',
          type: ProviderType.Ollama,
          apiKey: '',
          baseUrl: 'http://127.0.0.1:11435'
        })
      )

      const models = await provider.fetchAvailableModels()
      expect(models).toEqual(['bge-m3:latest', 'llama3:latest'])
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'http://127.0.0.1:11435/v1/models',
        expect.any(Object)
      )
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'http://127.0.0.1:11435/api/tags',
        expect.any(Object)
      )
    })

    it('fetches models from ollama /v1/models when available', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'bge-m3' }, { id: 'qwen2.5:7b' }]
        })
      } as Response)

      const provider = new OpenAIAdaptedProvider(
        createAiProvider({
          id: ProviderType.Ollama,
          name: 'Ollama',
          type: ProviderType.Ollama,
          apiKey: 'local',
          baseUrl: 'http://127.0.0.1:11435'
        })
      )

      const models = await provider.fetchAvailableModels()
      expect(models).toEqual(['bge-m3', 'qwen2.5:7b'])
      expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:11435/v1/models', expect.any(Object))
    })
  })
})
