import * as SQLite from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { logger } from '@baishou/shared'
import type { AppDatabase } from './types'
import { ensureExpoShadowIndexSchema } from './expo-shadow-schema'
import type { ExpoSqliteDatabase } from './drivers/expo-sqlite.driver'
import { SHADOW_INDEX_DB_FILENAME } from './shadow-index-schema.shared'

const SHADOW_DB_CACHE_KB = 512

function normalizeGlobalShadowDbDir(globalShadowDbDir: string): string {
  return globalShadowDbDir
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
}

/**
 * Mobile 影子索引连接管理器 — 对齐 Desktop 全局单库多 Vault 设计。
 * 所有 Vault 共享 `{globalShadowDbDir}/shadow_index_v2.db`。
 */
export class ExpoShadowIndexConnectionManager {
  private _expoDb: ExpoSqliteDatabase | null = null
  private _db: AppDatabase | null = null
  private _currentDbPath: string | null = null
  /** disconnect 后保留原生连接，避免重复 open / closeAsync */
  private _cachedConnection: {
    expoDb: ExpoSqliteDatabase
    db: AppDatabase
    dbPath: string
  } | null = null
  /** 串行化 connect / disconnect，避免并发 open 同一 DB 文件 */
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

  async connect(globalShadowDbDir: string): Promise<void> {
    await this.withOpLock(() => this.connectInternal(globalShadowDbDir))
  }

  private async connectInternal(globalShadowDbDir: string): Promise<void> {
    const dir = normalizeGlobalShadowDbDir(globalShadowDbDir)
    const dbPath = `${dir}/${SHADOW_INDEX_DB_FILENAME}`

    if (this._currentDbPath === dbPath && this._db && this._expoDb) {
      logger.info(`[ExpoShadowDB] 复用已有连接: ${dbPath}`)
      return
    }

    if (this._cachedConnection?.dbPath === dbPath) {
      this._expoDb = this._cachedConnection.expoDb
      this._db = this._cachedConnection.db
      this._currentDbPath = dbPath
      logger.info(`[ExpoShadowDB] 恢复已缓存连接: ${dbPath}`)
      return
    }

    if (this._expoDb && this._currentDbPath === dbPath) {
      this._db = drizzle(this._expoDb as any) as unknown as AppDatabase
      logger.info(`[ExpoShadowDB] 恢复已有原生连接: ${dbPath}`)
      return
    }

    logger.info(`[ExpoShadowDB] 正在连接影子索引库: ${dbPath}`)

    try {
      const expoDb = (await SQLite.openDatabaseAsync(
        SHADOW_INDEX_DB_FILENAME,
        { useNewConnection: true },
        dir
      )) as unknown as ExpoSqliteDatabase

      await ensureExpoShadowIndexSchema(expoDb)

      try {
        await expoDb.execAsync('PRAGMA journal_mode=WAL')
        await expoDb.execAsync(`PRAGMA cache_size=-${SHADOW_DB_CACHE_KB}`)
      } catch (e) {
        logger.warn('[ExpoShadowDB] PRAGMA 初始化失败，继续使用默认配置:', e as Error)
      }

      this._expoDb = expoDb
      this._db = drizzle(expoDb as any) as unknown as AppDatabase
      this._currentDbPath = dbPath
      this._cachedConnection = { expoDb, db: this._db, dbPath }

      logger.info(`[ExpoShadowDB] 影子索引库连接成功: ${dbPath}`)
    } catch (e) {
      this._expoDb = null
      this._db = null
      this._currentDbPath = null
      const message = e instanceof Error ? e.message : String(e)
      logger.error(`[ExpoShadowDB] 连接失败 (${dbPath}): ${message}`)
      throw new Error(`[ExpoShadowDB] 无法打开影子索引库: ${message}`)
    }
  }

  getDb(): AppDatabase {
    if (!this._db) {
      throw new Error('[ExpoShadowDB] 影子索引数据库尚未连接，请先调用 connect()')
    }
    return this._db
  }

  isConnected(): boolean {
    return this._db !== null && this._expoDb !== null
  }

  /**
   * 仅解除当前引用，不调用 closeAsync（规避 expo-sqlite native 崩溃）。
   * 底层连接在进程生命周期内保持打开，再次 connect 同一全局路径时复用。
   */
  async disconnect(): Promise<void> {
    await this.withOpLock(() => this.disconnectInternal())
  }

  private async disconnectInternal(): Promise<void> {
    const expoDb = this._expoDb
    const dbPath = this._currentDbPath
    this._expoDb = null
    this._db = null
    this._currentDbPath = null

    if (!dbPath) return

    try {
      await expoDb?.execAsync('PRAGMA shrink_memory')
    } catch (e) {
      logger.debug('[ExpoShadowDB] shrink_memory failed:', e as Error)
    }

    logger.info(`[ExpoShadowDB] 已解除当前影子索引连接引用: ${dbPath}`)
  }
}

export const shadowConnectionManager = new ExpoShadowIndexConnectionManager()
