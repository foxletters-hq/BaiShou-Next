import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deriveLegacyVaultId } from '@baishou/shared'
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
        vaultId: deriveLegacyVaultId('Personal'),
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
        vaultId: deriveLegacyVaultId('Personal'),
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
      vaultId: deriveLegacyVaultId('Personal'),
      requireSuccess: true
    })

    expect(hybridRepo.insertEmbedding).toHaveBeenCalledTimes(2)
  })

  it('prefixes each chunk with the date label and does not add tag metadata', async () => {
    const adapter = new EmbeddingAdapter(provider, 'text-embedding-3-small', hybridRepo)

    await adapter.embedText({
      text: '开会纪要',
      sourceType: 'diary',
      sourceId: '4',
      groupId: 'diary',
      vaultId: deriveLegacyVaultId('Personal'),
      chunkPrefix: '[2026-09-01 日记:]\n',
      requireSuccess: true
    })

    expect(mockEmbed).toHaveBeenCalledWith(
      expect.objectContaining({ value: '[2026-09-01 日记:]\n开会纪要' })
    )
    expect(hybridRepo.insertEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({ chunkText: '[2026-09-01 日记:]\n开会纪要' })
    )
  })

  it('prefixes every chunk with the date label', async () => {
    const adapter = new EmbeddingAdapter(provider, 'text-embedding-3-small', hybridRepo)
    const prefix = '[2026-09-01 日记:]\n'

    await adapter.embedText({
      text: 'x'.repeat(1500),
      sourceType: 'diary',
      sourceId: '5',
      groupId: 'diary',
      vaultId: deriveLegacyVaultId('Personal'),
      chunkPrefix: prefix,
      requireSuccess: true
    })

    expect(mockEmbed).toHaveBeenCalledTimes(2)
    expect(mockEmbed.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ value: expect.stringMatching(/^\[2026-09-01 日记:\]\n/) })
    )
    expect(mockEmbed.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ value: expect.stringMatching(/^\[2026-09-01 日记:\]\n/) })
    )
    expect(hybridRepo.insertEmbedding).toHaveBeenCalledTimes(2)
    expect(hybridRepo.insertEmbedding).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ chunkText: expect.stringMatching(/^\[2026-09-01 日记:\]\n/) })
    )
    expect(hybridRepo.insertEmbedding).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ chunkText: expect.stringMatching(/^\[2026-09-01 日记:\]\n/) })
    )
    expect(
      String((hybridRepo.insertEmbedding as ReturnType<typeof vi.fn>).mock.calls[0]?.[0].chunkText)
    ).not.toContain('[标签:')
  })
})
