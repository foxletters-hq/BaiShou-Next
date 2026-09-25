import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EmbeddingService } from '../embedding.service'
import { IEmbeddingStorage, IEmbeddingConfig } from '../embedding.types'

const { mockEmbed } = vi.hoisted(() => ({
  mockEmbed: vi.fn()
}))

vi.mock('ai', () => ({
  embed: mockEmbed
}))

const mockConfig: IEmbeddingConfig = {
  getGlobalEmbeddingModelId: vi.fn().mockReturnValue('Qwen/Qwen3-Embedding-4B'),
  getGlobalEmbeddingProviderId: vi.fn().mockReturnValue('siliconflow'),
  getGlobalEmbeddingDimension: vi.fn().mockReturnValue(2560),
  setGlobalEmbeddingDimension: vi.fn(),
  getProviderInstance: vi.fn().mockResolvedValue({
    getEmbeddingModel: vi.fn().mockReturnValue('mock-embedding-model')
  })
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

describe('EmbeddingService.embedQuery', () => {
  let service: EmbeddingService

  beforeEach(() => {
    service = new EmbeddingService(mockConfig, mockStorage)
    vi.clearAllMocks()
    vi.mocked(mockConfig.getGlobalEmbeddingModelId).mockReturnValue('Qwen/Qwen3-Embedding-4B')
    vi.mocked(mockConfig.getGlobalEmbeddingProviderId).mockReturnValue('siliconflow')
    vi.mocked(mockConfig.getProviderInstance).mockResolvedValue({
      getEmbeddingModel: vi.fn().mockReturnValue('mock-embedding-model')
    })
  })

  it('should throw the provider balance message instead of returning null', async () => {
    mockEmbed.mockRejectedValue({
      message: 'Payment Required',
      statusCode: 402,
      responseBody:
        '{"code":30001,"message":"Sorry, your account balance is insufficient","data":null}'
    })

    await expect(service.embedQuery('天气')).rejects.toThrow(
      'Sorry, your account balance is insufficient'
    )
  })

  it('should return null when embedding is not configured', async () => {
    vi.mocked(mockConfig.getGlobalEmbeddingModelId).mockReturnValue('')
    await expect(service.embedQuery('天气')).resolves.toBeNull()
    expect(mockEmbed).not.toHaveBeenCalled()
  })
})
