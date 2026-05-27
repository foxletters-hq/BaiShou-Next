import {
  IHybridSearchStorage,
  ISearchResult,
  IEmbeddingStorage,
  ISqlExecutor
} from '@baishou/shared'
import { sql } from 'drizzle-orm'
import { createHybridSearchRuntimeState } from './hybrid-search.repository.constants'
import {
  HybridSearchEmbeddingStore,
  HybridSearchMigrationStore
} from './hybrid-search.repository.embedding'
import { HybridSearchVectorQuery } from './hybrid-search.repository.vector-search'

function wrapSqlExecutor(db: any): ISqlExecutor {
  if (db && typeof db.execute === 'function') {
    return db
  }

  // 尝试从 Drizzle 实例或底层对象中提取 client
  const client = db?.session?.client || db?.$client || db

  return {
    execute: async (statement: string | { sql: string; args?: any[] }) => {
      let sqlStr = ''
      let sqlArgs: any[] = []
      if (typeof statement === 'string') {
        sqlStr = statement
      } else {
        sqlStr = statement.sql
        sqlArgs = statement.args || []
      }

      const isQuery =
        sqlStr.trim().toUpperCase().startsWith('SELECT') ||
        sqlStr.trim().toUpperCase().startsWith('PRAGMA')

      // 1. Better-SQLite3
      if (client && typeof client.prepare === 'function') {
        const stmt = client.prepare(sqlStr)
        if (isQuery) {
          return { rows: stmt.all(...sqlArgs) }
        } else {
          const res = stmt.run(...sqlArgs)
          return { rows: [], rowsAffected: res.changes }
        }
      }

      // 2. Expo-SQLite (RN Mobile)
      if (
        client &&
        typeof client.getAllAsync === 'function' &&
        typeof client.runAsync === 'function'
      ) {
        if (isQuery) {
          const rows = await client.getAllAsync(sqlStr, sqlArgs)
          return { rows }
        } else {
          const res = await client.runAsync(sqlStr, sqlArgs)
          return { rows: [], rowsAffected: res.changes }
        }
      }

      // 3. Drizzle ORM fallback via sql.raw
      if (db && typeof db.run === 'function' && typeof db.all === 'function') {
        if (isQuery) {
          const rows = await db.all(sql.raw(sqlStr), sqlArgs)
          return { rows }
        } else {
          const res = await db.run(sql.raw(sqlStr), sqlArgs)
          return { rows: [], rowsAffected: res.changes }
        }
      }

      // 4. Ultimate Drizzle run fallback
      if (db && typeof db.run === 'function') {
        const res = await db.run(sql.raw(sqlStr), sqlArgs)
        return { rows: Array.isArray(res) ? res : [], rowsAffected: res?.changes }
      }

      throw new Error(`Unsupported database client type for ISqlExecutor wrapping`)
    }
  }
}

/**
 * SQLite + libsql 混合搜索仓库
 *
 * 目标表：memory_embeddings（与 Drizzle ORM 管理的 memoryEmbeddingsTable 共用同一张物理表）
 *
 * 表结构对齐 packages/database/src/schema/vectors.ts：
 *   id              INTEGER PK AUTOINCREMENT
 *   embedding_id    TEXT UNIQUE NOT NULL
 *   source_type     TEXT NOT NULL
 *   source_id       TEXT NOT NULL
 *   group_id        TEXT NOT NULL
 *   chunk_index     INTEGER NOT NULL
 *   chunk_text      TEXT NOT NULL
 *   metadata_json   TEXT NOT NULL
 *   embedding       BLOB NOT NULL（Float32Array 二进制）
 *   dimension       INTEGER NOT NULL
 *   model_id        TEXT NOT NULL
 *   created_at      TIMESTAMP NOT NULL
 *   source_created_at TIMESTAMP
 *
 * 向量搜索策略：
 * - libsql 原生 vector_top_k ANN 检索（若 F32_BLOB 列兼容则可用）
 * - vec_distance_cosine 暴力余弦距离（通用可靠方案）
 * - 纯 JS 余弦距离降级（无扩展时的兜底）
 */
export class SqliteHybridSearchRepository implements IHybridSearchStorage, IEmbeddingStorage {
  private readonly runtime = createHybridSearchRuntimeState()
  private readonly embeddingStore: HybridSearchEmbeddingStore
  private readonly migrationStore: HybridSearchMigrationStore
  private readonly vectorQuery: HybridSearchVectorQuery

  constructor(db: any) {
    const wrappedDb = wrapSqlExecutor(db)
    this.embeddingStore = new HybridSearchEmbeddingStore(wrappedDb)
    this.migrationStore = new HybridSearchMigrationStore(wrappedDb)
    this.vectorQuery = new HybridSearchVectorQuery(wrappedDb, this.runtime)
  }

  initVectorIndex(...args: Parameters<HybridSearchEmbeddingStore['initVectorIndex']>) {
    return this.embeddingStore.initVectorIndex(...args)
  }

  initVectorTables(...args: Parameters<HybridSearchEmbeddingStore['initVectorTables']>) {
    return this.embeddingStore.initVectorTables(...args)
  }

  insertEmbedding(...args: Parameters<HybridSearchEmbeddingStore['insertEmbedding']>) {
    return this.embeddingStore.insertEmbedding(...args)
  }

  deleteEmbeddingsBySource(
    ...args: Parameters<HybridSearchEmbeddingStore['deleteEmbeddingsBySource']>
  ) {
    return this.embeddingStore.deleteEmbeddingsBySource(...args)
  }

  clearEmbeddings(...args: Parameters<HybridSearchEmbeddingStore['clearEmbeddings']>) {
    return this.embeddingStore.clearEmbeddings(...args)
  }

  clearAndReinitEmbeddings(
    ...args: Parameters<HybridSearchEmbeddingStore['clearAndReinitEmbeddings']>
  ) {
    return this.embeddingStore.clearAndReinitEmbeddings(...args)
  }

  hasPendingMigration(...args: Parameters<HybridSearchMigrationStore['hasPendingMigration']>) {
    return this.migrationStore.hasPendingMigration(...args)
  }

  countHeterogeneousEmbeddings(
    ...args: Parameters<HybridSearchMigrationStore['countHeterogeneousEmbeddings']>
  ) {
    return this.migrationStore.countHeterogeneousEmbeddings(...args)
  }

  createMigrationBackup(...args: Parameters<HybridSearchMigrationStore['createMigrationBackup']>) {
    return this.migrationStore.createMigrationBackup(...args)
  }

  dropMigrationBackup(...args: Parameters<HybridSearchMigrationStore['dropMigrationBackup']>) {
    return this.migrationStore.dropMigrationBackup(...args)
  }

  getUnmigratedCount(...args: Parameters<HybridSearchMigrationStore['getUnmigratedCount']>) {
    return this.migrationStore.getUnmigratedCount(...args)
  }

  getUnmigratedBackupChunks(
    ...args: Parameters<HybridSearchMigrationStore['getUnmigratedBackupChunks']>
  ) {
    return this.migrationStore.getUnmigratedBackupChunks(...args)
  }

  markBackupChunkMigrated(
    ...args: Parameters<HybridSearchMigrationStore['markBackupChunkMigrated']>
  ) {
    return this.migrationStore.markBackupChunkMigrated(...args)
  }

  verifyMigrationComplete(
    ...args: Parameters<HybridSearchMigrationStore['verifyMigrationComplete']>
  ) {
    return this.migrationStore.verifyMigrationComplete(...args)
  }

  createRollbackSnapshot(
    ...args: Parameters<HybridSearchMigrationStore['createRollbackSnapshot']>
  ) {
    return this.migrationStore.createRollbackSnapshot(...args)
  }

  restoreRollbackSnapshot(
    ...args: Parameters<HybridSearchMigrationStore['restoreRollbackSnapshot']>
  ) {
    return this.migrationStore.restoreRollbackSnapshot(...args)
  }

  dropRollbackSnapshot(...args: Parameters<HybridSearchMigrationStore['dropRollbackSnapshot']>) {
    return this.migrationStore.dropRollbackSnapshot(...args)
  }

  hasRollbackSnapshot(...args: Parameters<HybridSearchMigrationStore['hasRollbackSnapshot']>) {
    return this.migrationStore.hasRollbackSnapshot(...args)
  }

  getCurrentEmbeddingMeta(
    ...args: Parameters<HybridSearchMigrationStore['getCurrentEmbeddingMeta']>
  ) {
    return this.migrationStore.getCurrentEmbeddingMeta(...args)
  }

  supportsNativeVectorSearch(): boolean {
    return this.vectorQuery.supportsNativeVectorSearch()
  }

  queryFTS(...args: Parameters<HybridSearchVectorQuery['queryFTS']>): Promise<ISearchResult[]> {
    return this.vectorQuery.queryFTS(...args)
  }

  queryNativeVector(
    ...args: Parameters<HybridSearchVectorQuery['queryNativeVector']>
  ): Promise<ISearchResult[]> {
    return this.vectorQuery.queryNativeVector(...args)
  }

  fetchAllEmbeddingsForDecoupledSearch(
    ...args: Parameters<HybridSearchVectorQuery['fetchAllEmbeddingsForDecoupledSearch']>
  ) {
    return this.vectorQuery.fetchAllEmbeddingsForDecoupledSearch(...args)
  }
}
