import * as SQLite from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { logger } from '@baishou/shared'
import type { AppDatabase } from './types'
import type { ExpoSqliteDatabase } from './drivers/expo-sqlite.driver'
import { loadExpoSqliteVecExtension } from './drivers/expo-sqlite-vec.loader'
import {
  KNOWLEDGE_DB_FILENAME,
  ensureKnowledgeSchema
} from './knowledge-schema.shared'

const KNOWLEDGE_DB_CACHE_KB = 512

function normalizeKnowledgeDbDir(dir: string): string {
  return dir
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
}

/**
 * 移动端知识库连接管理器（独立 knowledge.db + 单独 loadSqliteVec）。
 *
 * 第二连接必须显式加载 sqlite-vec：不能照抄影子库（纯 libsql / 无 vec），
 * 也不能假设 Agent 主库已加载的扩展会自动出现在本连接上。
 */
export class ExpoKnowledgeConnectionManager {
  private _expoDb: ExpoSqliteDatabase | null = null
  private _db: AppDatabase | null = null
  private _currentDbPath: string | null = null
  private _vecLoaded = false
  private _vecLoadReason: string | undefined
  private _cachedConnection: {
    expoDb: ExpoSqliteDatabase
    db: AppDatabase
    dbPath: string
    vecLoaded: boolean
    vecLoadReason?: string
  } | null = null
  private _opChain: Promise<void> = Promise.resolve()

  private async withOpLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const previous = this._opChain
    this._opChain = previous.then(() => gate)
    await previous
    try {
      return await fn()
    } finally {
      release()
    }
  }

  async connect(knowledgeDbDir: string): Promise<void> {
    await this.withOpLock(() => this.connectInternal(knowledgeDbDir))
  }

  private async connectInternal(knowledgeDbDir: string): Promise<void> {
    const dir = normalizeKnowledgeDbDir(knowledgeDbDir)
    const dbPath = `${dir}/${KNOWLEDGE_DB_FILENAME}`

    if (this._currentDbPath === dbPath && this._db && this._expoDb) {
      logger.info(`[ExpoKnowledgeDB] 复用已有连接: ${dbPath}`)
      return
    }

    if (this._cachedConnection?.dbPath === dbPath) {
      this._expoDb = this._cachedConnection.expoDb
      this._db = this._cachedConnection.db
      this._currentDbPath = dbPath
      this._vecLoaded = this._cachedConnection.vecLoaded
      this._vecLoadReason = this._cachedConnection.vecLoadReason
      logger.info(`[ExpoKnowledgeDB] 恢复已缓存连接: ${dbPath}`)
      return
    }

    logger.info(`[ExpoKnowledgeDB] 正在连接知识库: ${dbPath}`)

    try {
      const expoDb = (await SQLite.openDatabaseAsync(
        KNOWLEDGE_DB_FILENAME,
        { useNewConnection: true },
        dir
      )) as unknown as ExpoSqliteDatabase

      // 第二连接必须单独加载 sqlite-vec（风险 5）
      const vecLoad = await loadExpoSqliteVecExtension(expoDb)
      this._vecLoaded = vecLoad.loaded
      this._vecLoadReason = vecLoad.reason
      if (vecLoad.loaded) {
        try {
          const row = await expoDb.getFirstAsync<{ v?: string }>('SELECT vec_version() AS v')
          logger.info(
            `[ExpoKnowledgeDB] sqlite-vec 已加载，vec_version()=${row?.v ?? 'loaded'}`
          )
        } catch (e) {
          logger.warn('[ExpoKnowledgeDB] vec_version() 探测失败:', e as Error)
        }
      } else {
        logger.warn(
          `[ExpoKnowledgeDB] sqlite-vec 未加载: ${vecLoad.reason ?? 'unknown'}（将退化为 JS 检索）`
        )
      }

      await ensureKnowledgeSchema(expoDb, '[ExpoKnowledgeDB]')

      try {
        await expoDb.execAsync('PRAGMA journal_mode=WAL')
        await expoDb.execAsync(`PRAGMA cache_size=-${KNOWLEDGE_DB_CACHE_KB}`)
        await expoDb.execAsync('PRAGMA foreign_keys=ON')
      } catch (e) {
        logger.warn('[ExpoKnowledgeDB] PRAGMA 初始化失败，继续使用默认配置:', e as Error)
      }

      this._expoDb = expoDb
      this._db = drizzle(expoDb as any) as unknown as AppDatabase
      this._currentDbPath = dbPath
      this._cachedConnection = {
        expoDb,
        db: this._db,
        dbPath,
        vecLoaded: this._vecLoaded,
        vecLoadReason: this._vecLoadReason
      }

      logger.info(`[ExpoKnowledgeDB] 知识库连接成功: ${dbPath}`)
    } catch (e) {
      this._expoDb = null
      this._db = null
      this._currentDbPath = null
      this._vecLoaded = false
      const message = e instanceof Error ? e.message : String(e)
      logger.error(`[ExpoKnowledgeDB] 连接失败 (${dbPath}): ${message}`)

      // 损坏时隔离重建（对齐桌面 KnowledgeConnectionManager）
      try {
        await this.deleteDbFiles(dir)
        const expoDb = (await SQLite.openDatabaseAsync(
          KNOWLEDGE_DB_FILENAME,
          { useNewConnection: true },
          dir
        )) as unknown as ExpoSqliteDatabase
        const vecLoad = await loadExpoSqliteVecExtension(expoDb)
        this._vecLoaded = vecLoad.loaded
        this._vecLoadReason = vecLoad.reason
        await ensureKnowledgeSchema(expoDb, '[ExpoKnowledgeDB]')
        this._expoDb = expoDb
        this._db = drizzle(expoDb as any) as unknown as AppDatabase
        this._currentDbPath = dbPath
        this._cachedConnection = {
          expoDb,
          db: this._db,
          dbPath,
          vecLoaded: this._vecLoaded,
          vecLoadReason: this._vecLoadReason
        }
        logger.info(`[ExpoKnowledgeDB] 损坏后重建成功: ${dbPath}`)
      } catch (retryErr) {
        const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr)
        logger.error(`[ExpoKnowledgeDB] 重建仍失败: ${retryMessage}`)
        throw new Error(`[ExpoKnowledgeDB] 无法打开知识库: ${retryMessage}`)
      }
    }
  }

  private async deleteDbFiles(dir: string): Promise<void> {
    const base = `${dir}/${KNOWLEDGE_DB_FILENAME}`
    for (const file of [base, `${base}-wal`, `${base}-shm`]) {
      try {
        await SQLite.deleteDatabaseAsync(KNOWLEDGE_DB_FILENAME, dir)
        break
      } catch {
        /* best-effort; WAL/SHM 可能需宿主清理 */
      }
      try {
        // 某些环境 deleteDatabaseAsync 只认文件名；再试一次忽略错误
        void file
      } catch {
        /* ignore */
      }
    }
  }

  getDb(): AppDatabase {
    if (!this._db) {
      throw new Error('[ExpoKnowledgeDB] 知识库尚未连接，请先调用 connect()')
    }
    return this._db
  }

  getExpoDb(): ExpoSqliteDatabase {
    if (!this._expoDb) {
      throw new Error('[ExpoKnowledgeDB] 知识库尚未连接，请先调用 connect()')
    }
    return this._expoDb
  }

  isConnected(): boolean {
    return this._db !== null && this._expoDb !== null
  }

  isSqliteVecLoaded(): boolean {
    return this._vecLoaded
  }

  getSqliteVecLoadReason(): string | undefined {
    return this._vecLoadReason
  }

  getCurrentPath(): string | null {
    return this._currentDbPath
  }

  async disconnect(): Promise<void> {
    await this.withOpLock(async () => {
      this._expoDb = null
      this._db = null
      this._currentDbPath = null
      // 保留 _cachedConnection，便于同路径快速恢复
    })
  }
}

/** 全局知识库连接单例（移动端） */
export const expoKnowledgeConnectionManager = new ExpoKnowledgeConnectionManager()
