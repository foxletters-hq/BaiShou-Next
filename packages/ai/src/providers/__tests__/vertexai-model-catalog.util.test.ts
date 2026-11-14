import { describe, it, expect, vi } from 'vitest'
import {
  buildSnapshotVertexAIModels,
  extractVertexModelsFromModelsDevPayload,
  isSupportedVertexGooglePublisherModelId,
  resolveFallbackVertexAIModels,
  sortVertexModelIdsNewestFirst
} from '../vertexai-model-catalog.util'

describe('vertexai-model-catalog.util', () => {
  it('should filter only supported Google publisher models', () => {
    expect(isSupportedVertexGooglePublisherModelId('gemini-3.5-flash')).toBe(true)
    expect(isSupportedVertexGooglePublisherModelId('gemini-embedding-001')).toBe(true)
    expect(isSupportedVertexGooglePublisherModelId('claude-sonnet-4-6@default')).toBe(false)
    expect(
      isSupportedVertexGooglePublisherModelId('meta/llama-4-maverick-17b-128e-instruct-maas')
    ).toBe(false)
    expect(isSupportedVertexGooglePublisherModelId('gemini-3-pro-image')).toBe(false)
    expect(isSupportedVertexGooglePublisherModelId('gemini-nano-banana-2.1')).toBe(false)
  })

  it('should sort newer Gemini generations before older ones and keep embeddings last', () => {
    const sorted = sortVertexModelIdsNewestFirst([
      'gemini-1.5-pro',
      'gemini-embedding-001',
      'gemini-2.5-flash',
      'gemini-3.5-flash',
      'gemini-4-carbon'
    ])
    expect(sorted).toEqual([
      'gemini-4-carbon',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-1.5-pro',
      'gemini-embedding-001'
    ])
  })

  it('should include latest Gemini 3.x / 4.x models from synced snapshots', () => {
    const models = buildSnapshotVertexAIModels()
    expect(models).toContain('gemini-3.5-flash')
    expect(models).toContain('gemini-3.1-pro-preview')
    expect(models).toContain('gemini-2.5-pro')
    expect(models).toContain('gemini-embedding-001')
    expect(models.some((id) => id.startsWith('claude-'))).toBe(false)
  })

  it('should merge newly published models from models.dev when online', async () => {
    const payload = {
      'google-vertex': {
        models: {
          'gemini-5.0-pro': {},
          'claude-opus-5@default': {},
          'gemini-3-pro-image': {}
        }
      }
    }
    expect(extractVertexModelsFromModelsDevPayload(payload)).toEqual(['gemini-5.0-pro'])

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => payload
    } as Response)

    const merged = await resolveFallbackVertexAIModels(fetchMock as unknown as typeof fetch)
    expect(merged[0]).toBe('gemini-5.0-pro')
    expect(merged).toContain('gemini-3.5-flash')
  })

  it('should fallback to snapshot models when models.dev is unreachable', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('network down'))
    const models = await resolveFallbackVertexAIModels(fetchMock as unknown as typeof fetch)
    expect(models).toEqual(buildSnapshotVertexAIModels())
  })
})
