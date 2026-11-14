import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import {
  VERTEX_AI_DEFAULT_MODELS,
  VertexAIAdaptedProvider,
  resolveVertexAIPublisherBaseUrl
} from '../vertexai.provider'

globalThis.fetch = vi.fn()

vi.mock('ai', () => ({
  generateText: vi.fn(),
  wrapLanguageModel: vi.fn(({ model }) => model)
}))

vi.mock('@ai-sdk/google', () => {
  const dummyModel = {}
  const dummyEmbedModel = {}
  const modelFn = vi.fn().mockReturnValue(dummyModel)
  const textEmbeddingModelFn = vi.fn().mockReturnValue(dummyEmbedModel)
  return {
    createGoogleGenerativeAI: vi.fn().mockReturnValue(
      Object.assign(modelFn, {
        textEmbeddingModel: textEmbeddingModelFn
      })
    )
  }
})

describe('resolveVertexAIPublisherBaseUrl', () => {
  it('should use default vertexai baseUrl with /publishers/google when empty', () => {
    expect(resolveVertexAIPublisherBaseUrl('')).toBe(
      'https://aiplatform.googleapis.com/v1/publishers/google'
    )
    expect(resolveVertexAIPublisherBaseUrl(undefined)).toBe(
      'https://aiplatform.googleapis.com/v1/publishers/google'
    )
  })

  it('should append /publishers/google to versioned aiplatform baseUrl', () => {
    expect(resolveVertexAIPublisherBaseUrl('https://aiplatform.googleapis.com/v1/')).toBe(
      'https://aiplatform.googleapis.com/v1/publishers/google'
    )
    expect(
      resolveVertexAIPublisherBaseUrl('https://us-central1-aiplatform.googleapis.com/v1beta1')
    ).toBe('https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google')
  })

  it('should add /v1/publishers/google when aiplatform host has no path', () => {
    expect(resolveVertexAIPublisherBaseUrl('https://aiplatform.googleapis.com')).toBe(
      'https://aiplatform.googleapis.com/v1/publishers/google'
    )
  })

  it('should keep existing /publishers/google suffix', () => {
    expect(
      resolveVertexAIPublisherBaseUrl('https://aiplatform.googleapis.com/v1/publishers/google/')
    ).toBe('https://aiplatform.googleapis.com/v1/publishers/google')
  })
})

describe('VertexAIAdaptedProvider', () => {
  let provider: VertexAIAdaptedProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new VertexAIAdaptedProvider({
      id: 'vertexai',
      name: 'Google Vertex AI',
      type: 'vertexai',
      apiKey: 'test-vertex-key',
      baseUrl: 'https://aiplatform.googleapis.com/v1'
    } as any)
  })

  describe('getLanguageModel & getEmbeddingModel', () => {
    it('should configure @ai-sdk/google with publishers/google baseURL and normalized model id', () => {
      provider.getLanguageModel('publishers/google/models/gemini-2.5-pro')

      expect(createGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-vertex-key',
          baseURL: 'https://aiplatform.googleapis.com/v1/publishers/google'
        })
      )
      const sdkInstance = vi.mocked(createGoogleGenerativeAI).mock.results[0]?.value
      expect(sdkInstance).toHaveBeenCalledWith('gemini-2.5-pro')
    })

    it('should return VertexAIEmbeddingModel with normalized model id', () => {
      const embedModel = provider.getEmbeddingModel('publishers/google/models/gemini-embedding-001')
      expect((embedModel as unknown as { modelId: string }).modelId).toBe('gemini-embedding-001')
      expect((embedModel as unknown as { provider: string }).provider).toBe('vertexai')
    })
  })

  describe('fetchAvailableModels', () => {
    it('should return empty array when apiKey is empty', async () => {
      provider = new VertexAIAdaptedProvider({
        id: 'vertexai',
        name: 'Google Vertex AI',
        type: 'vertexai',
        apiKey: ''
      } as any)

      const models = await provider.fetchAvailableModels()
      expect(models).toEqual([])
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should parse publisherModels with x-goog-api-key header and pageSize=1000', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          publisherModels: [
            { name: 'publishers/google/models/gemini-2.5-flash' },
            { name: 'publishers/google/models/gemini-3.5-flash' }
          ]
        })
      } as Response)

      const models = await provider.fetchAvailableModels()
      expect(fetch).toHaveBeenCalledWith(
        'https://aiplatform.googleapis.com/v1/publishers/google/models?pageSize=1000',
        expect.objectContaining({
          headers: expect.any(Headers)
        })
      )
      const headers = vi.mocked(fetch).mock.calls[0]?.[1]?.headers as Headers
      expect(headers.get('x-goog-api-key')).toBe('test-vertex-key')
      expect(models).toEqual(['gemini-3.5-flash', 'gemini-2.5-flash'])
    })

    it('should follow nextPageToken to collect newer models on later pages', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            publisherModels: [{ name: 'publishers/google/models/gemini-1.5-pro' }],
            nextPageToken: 'page-2'
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            publisherModels: [{ name: 'publishers/google/models/gemini-3.5-flash' }]
          })
        } as Response)

      const models = await provider.fetchAvailableModels()
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://aiplatform.googleapis.com/v1/publishers/google/models?pageSize=1000&pageToken=page-2',
        expect.anything()
      )
      expect(models).toEqual(['gemini-3.5-flash', 'gemini-1.5-pro'])
    })

    it('should try v1beta1 when v1 returns 404', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({})
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [{ name: 'models/gemini-3.5-flash' }]
          })
        } as Response)

      const models = await provider.fetchAvailableModels()
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'https://aiplatform.googleapis.com/v1/publishers/google/models?pageSize=1000',
        expect.anything()
      )
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://aiplatform.googleapis.com/v1beta1/publishers/google/models?pageSize=1000',
        expect.anything()
      )
      expect(models).toEqual(['gemini-3.5-flash'])
    })

    it('should fallback to dynamic models.dev + snapshot catalog when endpoints return 404 or 403', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({})
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({ error: { message: 'Permission denied' } })
        } as Response)
        .mockRejectedValueOnce(new Error('offline models.dev'))

      const models = await provider.fetchAvailableModels()
      expect(models).toEqual([...VERTEX_AI_DEFAULT_MODELS])
      expect(models).toContain('gemini-3.5-flash')
    })

    it('should throw when API key is explicitly invalid (400)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: { message: 'API key not valid. Please pass a valid API key.' }
        })
      } as Response)

      await expect(provider.fetchAvailableModels()).rejects.toThrow(
        'Failed to fetch Vertex AI models: 400'
      )
    })

    it('should throw on unexpected server error (500)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: { message: 'Internal error' } })
      } as Response)

      await expect(provider.fetchAvailableModels()).rejects.toThrow(
        'Failed to fetch Vertex AI models: 500 Internal error'
      )
    })
  })

  describe('testConnection', () => {
    it('should resolve when generateText succeeds', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({ text: 'ok' } as any)

      await expect(provider.testConnection('gemini-2.5-flash')).resolves.toBeUndefined()
      expect(generateText).toHaveBeenCalled()
    })

    it('should reject with wrapped error when generateText fails', async () => {
      vi.mocked(generateText).mockRejectedValueOnce(new Error('Vertex AI unreachable'))

      await expect(provider.testConnection()).rejects.toThrow('Connection test failed')
    })
  })
})
