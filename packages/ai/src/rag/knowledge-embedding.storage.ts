import type { IEmbeddingStorage } from '@baishou/shared'
import type { KnowledgeRepository } from '@baishou/database/shared'

/**
 * 知识库向量存储：IEmbeddingStorage → knowledge_chunks
 *
 * 迁移相关方法对知识库为 no-op / 固定返回（D6：异构时提示重建，不做在线迁移）。
 */
export class KnowledgeEmbeddingStorage implements IEmbeddingStorage {
  constructor(
    private readonly getRepo: () => KnowledgeRepository,
    private readonly resolveNotebookId: (groupId: string) => string = (g) => g
  ) {}

  async initVectorIndex(_dimension: number): Promise<void> {
    // ensureKnowledgeSchema 已建表
  }

  async insertEmbedding(params: {
    id: string
    sourceType: string
    sourceId: string
    groupId: string
    vaultId: string
    chunkIndex: number
    chunkText: string
    metadataJson?: string
    embedding: number[]
    modelId: string
    sourceCreatedAt?: number
  }): Promise<void> {
    const repo = this.getRepo()
    const notebookId = this.resolveNotebookId(params.groupId)
    const vectorBuffer = Buffer.from(new Float32Array(params.embedding).buffer)
    await repo.insertChunk({
      chunkId: params.id,
      vaultId: params.vaultId,
      notebookId,
      sourceId: params.sourceId,
      chunkIndex: params.chunkIndex,
      chunkText: params.chunkText,
      metadataJson: params.metadataJson ?? '{}',
      embedding: vectorBuffer,
      dimension: params.embedding.length,
      modelId: params.modelId
    })
  }

  async deleteEmbeddingsBySource(_sourceType: string, sourceId: string): Promise<void> {
    await this.getRepo().deleteChunksBySource(sourceId)
  }

  async clearEmbeddings(): Promise<void> {
    // 知识库不做全局清空入口；需按笔记本 rebuild
  }

  async hasPendingMigration(): Promise<boolean> {
    return false
  }
  async hasMigrationBackupTable(): Promise<boolean> {
    return false
  }
  async hasMigrationRollbackTable(): Promise<boolean> {
    return false
  }
  async countHeterogeneousEmbeddings(currentModelId: string): Promise<number> {
    return this.getRepo().countHeterogeneousEmbeddings(currentModelId)
  }
  async createMigrationBackup(): Promise<number> {
    return 0
  }
  async dropMigrationBackup(): Promise<void> {}
  async createRollbackSnapshot(): Promise<number> {
    return 0
  }
  async restoreRollbackSnapshot(): Promise<number> {
    return 0
  }
  async dropRollbackSnapshot(): Promise<void> {}
  async hasRollbackSnapshot(): Promise<boolean> {
    return false
  }
  async getCurrentEmbeddingMeta(): Promise<{
    modelId: string
    dimension: number
    count: number
  } | null> {
    return null
  }
  async clearAndReinitEmbeddings(_dimension: number): Promise<void> {}
  async getUnmigratedCount(): Promise<number> {
    return 0
  }
  async getUnmigratedBackupChunks(): Promise<unknown[]> {
    return []
  }
  async markBackupChunkMigrated(_embeddingId: string): Promise<void> {}
  async verifyMigrationComplete(_modelId: string): Promise<[boolean, boolean]> {
    return [true, true]
  }
}
