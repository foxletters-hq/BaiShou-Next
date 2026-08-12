import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIAdaptedProvider } from '../openai.provider'
import { ProviderType, createAiProvider } from '@baishou/shared'
// 模拟 @ai-sdk/openai
import * as openaiSdk from '@ai-sdk/openai'

globalThis.fetch = vi.fn()

vi.mock('@ai-sdk/openai', () => {
  const dummyModel = {}
  const dummyEmbedModel = {}
  const chatFn = vi.fn().mockReturnValue(dummyModel)
  const mockProvider = {
    chat: chatFn,
    textEmbeddingModel: vi.fn().mockReturnValue(dummyEmbedModel)
  }

  return {
    createOpenAI: vi.fn().mockReturnValue(mockProvider)
  }
})

describe('OpenAIAdaptedProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with correct custom baseURL and API key', () => {
    const config = createAiProvider({
      id: ProviderType.DeepSeek,
      name: 'DeepSeek',
      type: ProviderType.DeepSeek,
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.com/v1'
    })

    const provider = new OpenAIAdaptedProvider(config)
    expect(provider.config.id).toBe(ProviderType.DeepSeek)

    // 触发 SDK 创建以验证参数
    provider.getLanguageModel()

    expect(openaiSdk.createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com/v1',
        fetch: expect.any(Function)
      })
    )
  })

  it('should fallback to default parameters when executing getLanguageModel', () => {
    const config = createAiProvider({
      id: ProviderType.OpenAI,
      name: 'OpenAI',
      type: ProviderType.OpenAI,
      defaultDialogueModel: 'gpt-4o'
    })

    const provider = new OpenAIAdaptedProvider(config)
    const model = provider.getLanguageModel()
    expect(model).toBeDefined()
    // 验证 chat 方法以正确的模型 ID 被调用
    const mockProvider = vi.mocked(openaiSdk.createOpenAI).mock.results[0]!.value
    expect(mockProvider.chat).toHaveBeenCalledWith('gpt-4o')
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
  })
})
