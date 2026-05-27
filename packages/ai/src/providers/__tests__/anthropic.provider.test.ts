import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateText } from 'ai'
import { AnthropicAdaptedProvider } from '../anthropic.provider'

vi.mock('ai', () => ({
  generateText: vi.fn()
}))

vi.mock('@ai-sdk/anthropic', () => {
  const dummyModel = {}
  return {
    createAnthropic: vi.fn().mockReturnValue(vi.fn().mockReturnValue(dummyModel))
  }
})

describe('AnthropicAdaptedProvider', () => {
  let provider: AnthropicAdaptedProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new AnthropicAdaptedProvider({
      id: 'test_anthropic',
      name: 'Anthropic',
      type: 'anthropic',
      apiKey: 'test-key',
      baseUrl: 'https://test-anthropic.com'
    } as any)
  })

  describe('fetchAvailableModels', () => {
    it('should return default model list', async () => {
      const models = await provider.fetchAvailableModels()
      expect(models).toContain('claude-3-5-sonnet-20241022')
      expect(models.length).toBeGreaterThan(0)
    })
  })

  describe('testConnection', () => {
    it('should throw error if apiKey is missing', async () => {
      provider = new AnthropicAdaptedProvider({
        id: 'test_anthropic',
        name: 'Anthropic',
        type: 'anthropic',
        apiKey: ''
      } as any)

      vi.mocked(generateText).mockRejectedValueOnce(new Error('API key is required'))

      await expect(provider.testConnection()).rejects.toThrow('Connection test failed')
      expect(generateText).toHaveBeenCalled()
    })

    it('should throw error when generateText fails', async () => {
      vi.mocked(generateText).mockRejectedValueOnce(new Error('Unauthorized'))

      await expect(provider.testConnection()).rejects.toThrow(
        'Connection test failed: Unauthorized'
      )
    })

    it('should resolve when generateText succeeds', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({ text: 'ok' } as any)

      await expect(provider.testConnection()).resolves.toBeUndefined()
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'test',
          maxOutputTokens: 1
        })
      )
    })
  })
})
