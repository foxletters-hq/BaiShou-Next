import * as SQLite from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { logger } from '@baishou/shared'
import type { AppDatabase } from './types'
import { ensureExpoShadowIndexSchema } from './expo-shadow-schema'
import type { ExpoSqliteDatabase } from './drivers/expo-sqlite.driver'

const SHADOW_DB_FILENAME = 'shadow_index_v2.db'

function normalizeVaultSystemDir(vaultSystemDir: string): string {
  return vaultSystemDir.replace(/^file:\/\//, '').replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * Mobile 影子索引连接管理器 — 对齐 Desktop `ShadowIndexConnectionManager`：
 * 每个 Vault 独立 `shadow_index_v2.db`（Mobile 目录由 pathService.getShadowIndexDirectory 决定）。
 */
export class ExpoShadowIndexConnectionManager {
  private _expoDb: ExpoSqliteDatabase | null = null
  private _db: AppDatabase | null = null
  private _currentDbPath: string | null = null
  private _closePromise: Promise<void> | null = null
  private _connectChain: Promise<void> = Promise.resolve()

  async connect(vaultSystemDir: string): Promise<void> {
    const task = this._connectChain.then(() => this.connectInternal(vaultSystemDir))
    this._connectChain = task.catch(() => {})
    await task
  }

  private async connectInternal(vaultSystemDir: string): Promise<void> {
    const dir = normalizeVaultSystemDir(vaultSystemDir)
    const dbPath = `${dir}/${SHADOW_DB_FILENAME}`

    if (this._currentDbPath === dbPath && this._db && this._expoDb) {
      logger.info(`[ExpoShadowDB] 复用已有连接: ${dbPath}`)
      return
    }

    await this.disconnect()

    // Android expo-sqlite：close 后立即 open 新库偶发原生崩溃，留出释放窗口
    await new Promise((resolve) => setTimeout(resolve, 80))

    logger.info(`[ExpoShadowDB] 正在连接影子索引库: ${dbPath}`)

    try {
      const expoDb = (await SQLite.openDatabaseAsync(
        SHADOW_DB_FILENAME,
        { useNewConnection: true },
        dir
      )) as unknown as ExpoSqliteDatabase

      await ensureExpoShadowIndexSchema(expoDb)

      try {
        await expoDb.execAsync('PRAGMA journal_mode=WAL')
      } catch (e) {
        logger.warn('[ExpoShadowDB] WAL 模式设置失败，继续使用默认 journal:', e as Error)
      }

      this._expoDb = expoDb
      this._db = drizzle(expoDb as any) as unknown as AppDatabase
      this._currentDbPath = dbPath

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

  async disconnect(): Promise<void> {
    if (this._closePromise) {
      await this._closePromise
      return
    }

    const expoDb = this._expoDb
    this._expoDb = null
    this._db = null
    this._currentDbPath = null

    if (!expoDb) return

    this._closePromise = expoDb
      .closeAsync()
      .catch((e) => {
        logger.warn('[ExpoShadowDB] closeAsync failed:', e as Error)
      })
      .finally(() => {
        this._closePromise = null
      })

    await this._closePromise
  }
}

export const shadowConnectionManager = new ExpoShadowIndexConnectionManager()
