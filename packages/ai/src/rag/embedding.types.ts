export interface ChunkResult {
  index: number;
  text: string;
}

export interface MigrationProgress {
  total: number;
  completed: number;
  failed?: number;
  status: string;
}

/**
 * 为了与 Beta 提供的数据存储解耦而抽象的数据接口
 * (原版 AgentDatabase 中关于 Embedding 的部分)
 */
export interface IEmbeddingStorage {
  initVectorIndex(dimension: number): Promise<void>;
  
  insertEmbedding(params: {
    id: string;
    sourceType: string;
    sourceId: string;
    groupId: string;
    chunkIndex: number;
    chunkText: string;
    metadataJson?: string;
    embedding: number[];
    modelId: string;
    sourceCreatedAt?: number;
  }): Promise<void>;
  
  deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void>;
  clearEmbeddings(): Promise<void>;

  // --- 迁移用的 ---
  hasPendingMigration(): Promise<boolean>;
  countHeterogeneousEmbeddings(currentModelId: string): Promise<number>;
  createMigrationBackup(): Promise<number>;
  dropMigrationBackup(): Promise<void>;
  clearAndReinitEmbeddings(dimension: number): Promise<void>;
  getUnmigratedCount(): Promise<number>;
  getUnmigratedBackupChunks(): Promise<any[]>;
  markBackupChunkMigrated(embeddingId: string): Promise<void>;
  verifyMigrationComplete(modelId: string): Promise<[boolean, boolean]>;
}

/**
 * 为了与 Gamma 提供的全局配置解耦而抽象的配置接口
 * (原版 ApiConfigService 中关于 Embedding 的部分)
 */
export interface IEmbeddingConfig {
  getGlobalEmbeddingModelId(): string;
  getGlobalEmbeddingProviderId(): string;
  getGlobalEmbeddingDimension(): number;
  setGlobalEmbeddingDimension(dimension: number): Promise<void>;
  getProviderInstance(): Promise<any>;
}
