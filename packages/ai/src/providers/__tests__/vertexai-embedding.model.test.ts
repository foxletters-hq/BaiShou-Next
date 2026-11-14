import { describe, it, expect, vi } from 'vitest'
import { TooManyEmbeddingValuesForCallError } from '@ai-sdk/provider'
import { VertexAIEmbeddingModel } from '../vertexai-embedding.model'

describe('VertexAIEmbeddingModel', () => {
  it('should call :predict endpoint with x-goog-api-key and parse predictions', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        predictions: [
          {
            embeddings: {
              values: [0.1, 0.2, 0.3],
              statistics: { token_count: 5 }
            }
          },
          {
            embeddings: {
              values: [0.4, 0.5, 0.6],
              statistics: { token_count: 7 }
            }
          }
        ]
      })
    } as Response)

    const model = new VertexAIEmbeddingModel('gemini-embedding-001', {
      provider: 'vertexai',
      baseURL: 'https://aiplatform.googleapis.com/v1/publishers/google',
      apiKey: 'test-vertex-key',
      fetch: fetchMock as unknown as typeof fetch
    })

    const result = await model.doEmbed({
      values: ['doc 1', 'doc 2']
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(
      'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-embedding-001:predict'
    )
    expect(init?.method).toBe('POST')
    expect((init?.headers as Headers).get('x-goog-api-key')).toBe('test-vertex-key')
    expect(JSON.parse(String(init?.body))).toEqual({
      instances: [{ content: 'doc 1' }, { content: 'doc 2' }]
    })
    expect(result.embeddings).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6]
    ])
    expect(result.usage).toEqual({ tokens: 12 })
  })

  it('should forward taskType and outputDimensionality from providerOptions', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      json: async () => ({
        predictions: [{ embeddings: { values: [0.9, 0.1] } }]
      })
    } as Response)

    const model = new VertexAIEmbeddingModel('gemini-embedding-001', {
      provider: 'vertexai',
      baseURL: 'https://aiplatform.googleapis.com/v1/publishers/google',
      apiKey: 'test-vertex-key',
      fetch: fetchMock as unknown as typeof fetch
    })

    await model.doEmbed({
      values: ['search query'],
      providerOptions: {
        google: {
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: 768
        }
      }
    })

    const [, init] = fetchMock.mock.calls[0]!
    expect(JSON.parse(String(init?.body))).toEqual({
      instances: [{ content: 'search query', task_type: 'RETRIEVAL_QUERY' }],
      parameters: { outputDimensionality: 768 }
    })
  })

  it('should throw HTTP error with statusCode when :predict returns non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'Model not found' } })
    } as Response)

    const model = new VertexAIEmbeddingModel('gemini-embedding-001', {
      provider: 'vertexai',
      baseURL: 'https://aiplatform.googleapis.com/v1/publishers/google',
      apiKey: 'test-vertex-key',
      fetch: fetchMock as unknown as typeof fetch
    })

    await expect(model.doEmbed({ values: ['hello'] })).rejects.toMatchObject({
      statusCode: 400,
      status: 400,
      message: expect.stringContaining('Model not found')
    })
  })

  it('should throw when response prediction count mismatches input values', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      json: async () => ({ predictions: [] })
    } as Response)

    const model = new VertexAIEmbeddingModel('gemini-embedding-001', {
      provider: 'vertexai',
      baseURL: 'https://aiplatform.googleapis.com/v1/publishers/google',
      apiKey: 'test-vertex-key',
      fetch: fetchMock as unknown as typeof fetch
    })

    await expect(model.doEmbed({ values: ['hello'] })).rejects.toThrow('response mismatch')
  })

  it('should return empty embeddings without fetching when values is empty', async () => {
    const fetchMock = vi.fn()
    const model = new VertexAIEmbeddingModel('gemini-embedding-001', {
      provider: 'vertexai',
      baseURL: 'https://aiplatform.googleapis.com/v1/publishers/google',
      apiKey: 'test-vertex-key',
      fetch: fetchMock as unknown as typeof fetch
    })

    const result = await model.doEmbed({ values: [] })
    expect(result.embeddings).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should throw TooManyEmbeddingValuesForCallError when values exceed limit', async () => {
    const model = new VertexAIEmbeddingModel('gemini-embedding-001', {
      provider: 'vertexai',
      baseURL: 'https://aiplatform.googleapis.com/v1/publishers/google',
      apiKey: 'test-vertex-key',
      fetch: vi.fn() as unknown as typeof fetch
    })

    const tooMany = Array.from({ length: 251 }, (_, i) => `item-${i}`)
    await expect(model.doEmbed({ values: tooMany })).rejects.toBeInstanceOf(
      TooManyEmbeddingValuesForCallError
    )
  })
})
