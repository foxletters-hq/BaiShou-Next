import { describe, expect, it, vi } from 'vitest'
import {
  EMBED_API_PROBE_FAILURE_MESSAGE,
  EMBED_API_PROBE_TEXT,
  probeEmbeddingApi
} from '../embed-api-probe.util'

describe('probeEmbeddingApi', () => {
  it('should return ok when embedQuery yields a vector', async () => {
    const embedQuery = vi.fn(async () => [0.1, 0.2])
    await expect(probeEmbeddingApi(embedQuery)).resolves.toEqual({ ok: true })
    expect(embedQuery).toHaveBeenCalledWith(EMBED_API_PROBE_TEXT)
  })

  it('should return failure when embedQuery yields null', async () => {
    await expect(probeEmbeddingApi(async () => null)).resolves.toEqual({
      ok: false,
      message: EMBED_API_PROBE_FAILURE_MESSAGE
    })
  })

  it('should return failure when embedQuery yields an empty vector', async () => {
    await expect(probeEmbeddingApi(async () => [])).resolves.toEqual({
      ok: false,
      message: EMBED_API_PROBE_FAILURE_MESSAGE
    })
  })
})
