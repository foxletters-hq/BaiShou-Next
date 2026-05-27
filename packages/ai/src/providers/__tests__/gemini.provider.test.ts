import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateText } from 'ai'
import { GeminiAdaptedProvider } from '../gemini.provider'

globalThis.fetch = vi.fn()

vi.mock('ai', () => ({
  generateText: vi.fn()
}))

vi.mock('@ai-sdk/google', () => {
  const dummyModel = {}
  const dummyEmbedModel = {}
  return {
    createGoogleGenerativeAI: vi.fn().mockReturnValue(
      Object.assign(vi.fn().mockReturnValue(dummyModel), {
        textEmbeddingModel: vi.fn().mockReturnValue(dummyEmbedModel)
      })
    )
  }
})

describe('GeminiAdaptedProvider', () => {
  let provider: GeminiAdaptedProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new GeminiAdaptedProvider({
      id: 'test_gemini',
      name: 'Gemini',
      type: 'gemini',
      apiKey: 'test-key',
      baseUrl: 'https://test-gemini.com'
    } as any)
  })

  describe('fetchAvailableModels', () => {
    it('should return empty array if no apiKey is provided', async () => {
      provider = new GeminiAdaptedProvider({
        id: 'test_gemini',
        name: 'Gemini',
        type: 'gemini',
        apiKey: ''
      } as any)
      const models = await provider.fetchAvailableModels()
      expect(models).toEqual([])
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should fetch and parse models from API', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'models/gemini-pro' }, { name: 'models/gemini-flash' }]
        })
      } as Response)

      const models = await provider.fetchAvailableModels()
      expect(fetch).toHaveBeenCalledWith('https://test-gemini.com/models?key=test-key')
      expect(models).toEqual(['gemini-pro', 'gemini-flash'])
    })

    it('should throw when fetch returns not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid API key' } })
      } as Response)

      await expect(provider.fetchAvailableModels()).rejects.toThrow('Failed to fetch Gemini models')
    })
  })

  describe('testConnection', () => {
    it('should resolve when generateText succeeds', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({ text: 'ok' } as any)

      await expect(provider.testConnection()).resolves.toBeUndefined()
      expect(generateText).toHaveBeenCalled()
    })

    it('should reject when generateText fails', async () => {
      provider = new GeminiAdaptedProvider({
        id: 'test_gemini',
        name: 'Gemini',
        type: 'gemini',
        apiKey: ''
      } as any)

      vi.mocked(generateText).mockRejectedValueOnce(new Error('Unable to connect to Gemini API'))

      await expect(provider.testConnection()).rejects.toThrow('Connection test failed')
    })
  })
})
