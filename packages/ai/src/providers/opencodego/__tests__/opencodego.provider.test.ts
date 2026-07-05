import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateText } from 'ai'
import { OpenCodeGoAdaptedProvider } from '../opencodego.provider'
import * as modelsClient from '../opencodego.models-client'
import * as languageModelFactory from '../opencodego.language-model.factory'

vi.mock('ai', () => ({
  generateText: vi.fn()
}))

const { dummyModel } = vi.hoisted(() => ({
  dummyModel: {}
}))

vi.mock('../opencodego.language-model.factory', () => ({
  createOpenCodeGoLanguageModel: vi.fn().mockReturnValue(dummyModel),
  resolveOpenCodeGoBaseUrl: vi.fn().mockReturnValue('https://opencode.ai/zen/go/v1')
}))

vi.mock('../opencodego.models-client', () => ({
  fetchOpenCodeGoModelIds: vi.fn()
}))

describe('OpenCodeGoAdaptedProvider', () => {
  let provider: OpenCodeGoAdaptedProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new OpenCodeGoAdaptedProvider({
      id: 'opencodego',
      name: 'OpenCode Go',
      type: 'opencodego',
      apiKey: 'test-key',
      baseUrl: 'https://opencode.ai/zen/go/v1'
    } as any)
  })

  describe('getLanguageModel', () => {
    it('delegates to language model factory with model id', () => {
      provider.getLanguageModel('kimi-k2.7-code')
      expect(languageModelFactory.createOpenCodeGoLanguageModel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'opencodego' }),
        'kimi-k2.7-code'
      )
    })
  })

  describe('fetchAvailableModels', () => {
    it('delegates to models client', async () => {
      vi.mocked(modelsClient.fetchOpenCodeGoModelIds).mockResolvedValueOnce([
        'kimi-k2.7-code',
        'minimax-m3'
      ])

      const models = await provider.fetchAvailableModels()
      expect(models).toEqual(['kimi-k2.7-code', 'minimax-m3'])
      expect(modelsClient.fetchOpenCodeGoModelIds).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'opencodego' })
      )
    })
  })

  describe('testConnection', () => {
    it('resolves when generateText succeeds', async () => {
      vi.mocked(modelsClient.fetchOpenCodeGoModelIds).mockResolvedValueOnce(['kimi-k2.7-code'])
      vi.mocked(generateText).mockResolvedValueOnce({ text: 'ok' } as any)

      await expect(provider.testConnection('kimi-k2.7-code')).resolves.toBeUndefined()
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'test',
          maxOutputTokens: 1
        })
      )
    })

    it('throws when generateText fails', async () => {
      vi.mocked(modelsClient.fetchOpenCodeGoModelIds).mockResolvedValueOnce(['kimi-k2.7-code'])
      vi.mocked(generateText).mockRejectedValueOnce(new Error('Unauthorized'))

      await expect(provider.testConnection('kimi-k2.7-code')).rejects.toThrow(
        'Connection test failed: Unauthorized'
      )
    })
  })

  describe('getEmbeddingModel', () => {
    it('throws unsupported error', () => {
      expect(() => provider.getEmbeddingModel()).toThrow('does not provide embedding')
    })
  })
})
