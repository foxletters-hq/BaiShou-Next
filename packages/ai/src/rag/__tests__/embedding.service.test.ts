import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EmbeddingService } from '../embedding.service'
import { IEmbeddingStorage, IEmbeddingConfig } from '../embedding.types'

const mockConfig: IEmbeddingConfig = {
  getGlobalEmbeddingModelId: vi.fn().mockReturnValue('mock-model'),
  getGlobalEmbeddingProviderId: vi.fn().mockReturnValue('mock-provider'),
  getGlobalEmbeddingDimension: vi.fn().mockReturnValue(0),
  setGlobalEmbeddingDimension: vi.fn(),
  getProviderInstance: vi.fn().mockResolvedValue({})
}

const mockStorage: IEmbeddingStorage = {
  initVectorIndex: vi.fn(),
  insertEmbedding: vi.fn(),
  deleteEmbeddingsBySource: vi.fn(),
  recordEmbedded: vi.fn(),
  recordEmbedFailure: vi.fn(),
  clearEmbeddings: vi.fn(),
  hasPendingMigration: vi.fn(),
  hasMigrationBackupTable: vi.fn().mockResolvedValue(true),
  hasMigrationRollbackTable: vi.fn().mockResolvedValue(false),
  countHeterogeneousEmbeddings: vi.fn(),
  createMigrationBackup: vi.fn(),
  dropMigrationBackup: vi.fn(),
  clearAndReinitEmbeddings: vi.fn(),
  getUnmigratedCount: vi.fn(),
  getUnmigratedBackupChunks: vi.fn(),
  markBackupChunkMigrated: vi.fn(),
  verifyMigrationComplete: vi.fn(),
  createRollbackSnapshot: vi.fn(),
  restoreRollbackSnapshot: vi.fn(),
  dropRollbackSnapshot: vi.fn(),
  hasRollbackSnapshot: vi.fn().mockResolvedValue(false),
  getCurrentEmbeddingMeta: vi.fn()
}

describe('EmbeddingService', () => {
  let service: EmbeddingService

  beforeEach(() => {
    service = new EmbeddingService(mockConfig, mockStorage)
    vi.clearAllMocks()
  })

  describe('Normalize (L2)', () => {
    it('should normalize vectors to unit length (length=1)', () => {
      const raw = [1.0, 2.0, 3.0]
      const normalized = service.normalize(raw)
      let norm = 0
      for (const v of normalized) norm += v * v
      // JS 浮点计算可能有微小误差，使用 toBeCloseTo
      expect(Math.abs(norm - 1.0)).toBeLessThan(0.0001)
    })

    it('should handle zero vector without dividing by zero', () => {
      const raw = [0, 0, 0]
      const normalized = service.normalize(raw)
      expect(normalized).toEqual([0, 0, 0])
    })
  })

  describe('tiktoken Chunking', () => {
    it('should split text exceeding max chunk tokens correctly with overlaps', () => {
      // 生成足够长的重复文本
      const text = 'Word '.repeat(2000)
      const chunks = service.splitIntoChunks(text)
      expect(chunks.length).toBeGreaterThan(1)

      // 验证重叠
      expect(chunks[0]!.index).toBe(0)
      expect(chunks[1]!.index).toBe(1)

      // tiktoken 的文本切片包含了空格还原，且至少保证每块都能输出字符串
      expect(chunks[0]!.text.length).toBeGreaterThan(0)
      expect(chunks[1]!.text.length).toBeGreaterThan(0)
    })

    it('should not split short text', () => {
      const text = 'Hello World'
      const chunks = service.splitIntoChunks(text)
      expect(chunks.length).toBe(1)
      expect(chunks[0]!.text).toBe(text)
      expect(chunks[0]!.index).toBe(0)
    })
  })

  describe('embedText ledger', () => {
    it('records a zero ledger row when text is empty', async () => {
      await service.embedText({
        text: '   ',
        sourceType: 'diary',
        sourceId: 'vault-a#empty',
        groupId: 'diary',
        vaultId: 'vault-a',
        contentHash: 'empty-hash'
      })

      expect(mockStorage.insertEmbedding).not.toHaveBeenCalled()
      expect(mockStorage.recordEmbedded).toHaveBeenCalledWith(
        expect.objectContaining({
          vaultId: 'vault-a',
          sourceType: 'diary',
          sourceId: 'vault-a#empty',
          contentHash: 'empty-hash',
          chunkCount: 0
        })
      )
    })

    it('does not write ledger when embedding model is not configured', async () => {
      vi.mocked(mockConfig.getGlobalEmbeddingModelId).mockReturnValueOnce('')
      await service.embedText({
        text: '',
        sourceType: 'diary',
        sourceId: 'vault-a#empty',
        groupId: 'diary',
        vaultId: 'vault-a'
      })
      expect(mockStorage.recordEmbedded).not.toHaveBeenCalled()
    })
  })

  describe('updateMemoryChunk guard', () => {
    it.each(['diary', 'memory'])('refuses to update a %s chunk in place', async (sourceType) => {
      await expect(
        service.updateMemoryChunk({
          entry: {
            embedding_id: 'emb-1',
            source_type: sourceType,
            source_id: 'vault-a#1',
            group_id: 'g',
            vault_id: 'vault-a',
            chunk_index: 0
          },
          newText: '改过的正文'
        })
      ).rejects.toThrow('reEmbedText')

      expect(mockStorage.insertEmbedding).not.toHaveBeenCalled()
    })

    it('lets source types that stay out of the ledger through the guard', async () => {
      // 走到真实的取模型一步才失败，说明守卫没有挡住 chat 这类不进账本的来源
      await expect(
        service.updateMemoryChunk({
          entry: {
            embedding_id: 'emb-2',
            source_type: 'chat',
            source_id: 'msg-1',
            group_id: 'session-1',
            vault_id: 'vault-a',
            chunk_index: 0
          },
          newText: '改过的对话'
        })
      ).rejects.toThrow('getEmbeddingModel')
    })
  })
})
