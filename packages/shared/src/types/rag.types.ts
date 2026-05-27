export type SearchSource = 'fts' | 'vector' | 'hybrid'

export interface ISearchResult {
  messageId: string
  sessionId: string
  chunkText: string
  score: number
  source: SearchSource
  createdAt?: number
}

export interface ISearchQueryOptions {
  queryVector: number[] // RAG 已预处理后的密集向量数组
  queryText: string // FTS5 用户分词
  topK?: number // 默认 20
  similarityThreshold?: number // 如果纯余弦距离低于阈值，抛弃不再参与 RRF 排位
  ftsWeight?: number // RRF 合成时关键词权重，默认 0.3
  vectorWeight?: number // RRF 合成时向量占比，默认 0.7
}

/**
 * 供 Hybrid 搜索服务调用的仓储适配器模型。
 * 由于 SQLite 在没有 vec 拓展或者其他轻量数据库中欠缺底层 KNN，$native 接口可能不存在或引发异常，因此允许优雅降级。
 */
export interface IHybridSearchStorage {
  /**
   * 判断当前数据库设施是否支持底层硬件或原生指令层面的 Vector 检索计算。
   * 如果支持，可以直接让 DB 执行查询；如果不支持，获取全局所有 Embedding 到内存中由 Node 计算。
   */
  supportsNativeVectorSearch(): boolean

  /**
   * 获取纯正 FTS (全文关键字) 查询返回的对象集，其内的 Score 可以是无意义的分词命中最值
   */
  queryFTS(keyword: string, limit: number): Promise<ISearchResult[]>

  /**
   * (原生方案) 如果 supportsNativeVectorSearch 为 true 则执行并返回
   */
  queryNativeVector(vector: number[], limit: number, threshold?: number): Promise<ISearchResult[]>

  /**
   * (降级方案) 如果原生不支持，则使用该方法一次性取回全量 Memory Vector（通常在特定 Session 下有数量上限），
   * 把它们以裸格式传给 JS 调度层纯函数的 KNN 进行遍历裁切
   */
  fetchAllEmbeddingsForDecoupledSearch(sessionGroupId?: string): Promise<
    {
      messageId: string
      sessionId: string
      chunkText: string
      embedding: number[]
      createdAt?: number
    }[]
  >
}

export interface ChunkResult {
  index: number
  text: string
}

export interface MigrationProgress {
  total: number
  completed: number
  failed?: number
  status: string
}

/**
 * 为了与 Beta 提供的数据存储解耦而抽象的数据接口
 * (原版 AgentDatabase 中关于 Embedding 的部分)
 */
export interface IEmbeddingStorage {
  initVectorIndex(dimension: number): Promise<void>

  insertEmbedding(params: {
    id: string
    sourceType: string
    sourceId: string
    groupId: string
    chunkIndex: number
    chunkText: string
    metadataJson?: string
    embedding: number[]
    modelId: string
    sourceCreatedAt?: number
  }): Promise<void>

  deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void>
  clearEmbeddings(): Promise<void>

  // --- 迁移用的 ---
  hasPendingMigration(): Promise<boolean>
  countHeterogeneousEmbeddings(currentModelId: string): Promise<number>
  createMigrationBackup(): Promise<number>
  dropMigrationBackup(): Promise<void>
  clearAndReinitEmbeddings(dimension: number): Promise<void>
  getUnmigratedCount(): Promise<number>
  getUnmigratedBackupChunks(): Promise<any[]>
  markBackupChunkMigrated(embeddingId: string): Promise<void>
  verifyMigrationComplete(modelId: string): Promise<[boolean, boolean]>
}

/**
 * 为了与 Gamma 提供的全局配置解耦而抽象的配置接口
 * (原版 ApiConfigService 中关于 Embedding 的部分)
 */
export interface IEmbeddingConfig {
  getGlobalEmbeddingModelId(): string
  getGlobalEmbeddingProviderId(): string
  getGlobalEmbeddingDimension(): number
  setGlobalEmbeddingDimension(dimension: number): Promise<void>
  getProviderInstance(): Promise<any>
}

/**
 * 为了与 @libsql/client 解耦而抽象的最小 SQL 执行接口。
 *
 * 使用方（如 SqliteHybridSearchRepository）只依赖此接口，
 * 运行时由 LibSQL 适配器或 BetterSqlite3 适配器注入，
 * 符合依赖倒置原则（DIP）。
 */
export interface ISqlExecutor {
  /**
   * 执行一条 SQL 语句，支持参数绑定。
   * @param query - SQL 字符串 或 { sql, args } 对象
   */
  execute(
    query:
      | string
      | {
          sql: string
          args?: Array<string | number | null | Uint8Array | ArrayBuffer>
        }
  ): Promise<{
    rows: Array<Record<string, unknown>>
    rowsAffected?: number
  }>
}
