import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EmbeddingAdapter } from '../embedding.adapter'
import type { IAIProvider } from '../../../providers/provider.interface'
import type { SqliteHybridSearchRepository } from '@baishou/database'

const { mockEmbed } = vi.hoisted(() => ({
  mockEmbed: vi.fn()
}))

vi.mock('ai', () => ({
  embed: mockEmbed
}))

function createLongText(chunks: number): string {
  return 'x'.repeat(1024 * chunks)
}

describe('EmbeddingAdapter', () => {
  const provider = {
    getEmbeddingModel: vi.fn().mockReturnValue('mock-embedding-model')
  } as unknown as IAIProvider

  const hybridRepo = {
    insertEmbedding: vi.fn().mockResolvedValue(undefined)
  } as unknown as SqliteHybridSearchRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] })
  })

  it('throws when requireSuccess and all chunks fail', async () => {
    mockEmbed.mockRejectedValue(new Error('api down'))
    const adapter = new EmbeddingAdapter(provider, 'text-embedding-3-small', hybridRepo)

    await expect(
      adapter.embedText({
        text: 'short diary',
        sourceType: 'diary',
        sourceId: '1',
        groupId: 'batch',
        requireSuccess: true
      })
    ).rejects.toThrow(/Embedding API returned no vectors/)
  })

  it('throws when requireSuccess and only some chunks succeed', async () => {
    let call = 0
    mockEmbed.mockImplementation(async () => {
      call++
      if (call === 1) return { embedding: [1, 0, 0] }
      throw new Error('rate limited')
    })

    const adapter = new EmbeddingAdapter(provider, 'text-embedding-3-small', hybridRepo)

    await expect(
      adapter.embedText({
        text: createLongText(2),
        sourceType: 'diary',
        sourceId: '2',
        groupId: 'batch',
        requireSuccess: true
      })
    ).rejects.toThrow(/incomplete vectors/)
  })

  it('succeeds when all chunks embed', async () => {
    const adapter = new EmbeddingAdapter(provider, 'text-embedding-3-small', hybridRepo)

    await adapter.embedText({
      text: 'x'.repeat(1500),
      sourceType: 'diary',
      sourceId: '3',
      groupId: 'batch',
      requireSuccess: true
    })

    expect(hybridRepo.insertEmbedding).toHaveBeenCalledTimes(2)
  })
})
