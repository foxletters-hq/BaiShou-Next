import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import { logger } from '@baishou/shared'

import type { AppDatabase } from './types'
import {
  KNOWLEDGE_DB_FILENAME,
  ensureKnowledgeSchema
} from './knowledge-schema.shared'

/**
 * 知识库连接管理器（桌面 better-sqlite3 + sqlite-vec）
 *
 * - 库文件：`{storageRoot}/knowledge.db`（与 Agent 库同解析规则）
 * - 打开时显式 `sqliteVec.load`，并用 `vec_version()` 探测
 * - 不进 Agent MigrationService；schema 由 `ensureKnowledgeSchema` 独立管理
 */
export class KnowledgeConnectionManager {
  private _sqlite: Database.Database | null = null
  private _db: AppDatabase | null = null
  private _currentDbPath: string | null = null
  private _vecVersion: string | null = null

  /**
   * @param knowledgeDbDir 存放 knowledge.db 的目录（通常为存储根）
   */
  async connect(knowledgeDbDir: string): Promise<void> {
    const dbPath = path.join(knowledgeDbDir, KNOWLEDGE_DB_FILENAME)
    const started = performance.now()

    if (this._currentDbPath === dbPath && this._sqlite && this._db) {
      logger.info(`[KnowledgeDB] 复用已有连接: ${dbPath}`)
      return
    }

    if (this._currentDbPath !== dbPath) {
      this._disconnect()
    }

    logger.info(`[KnowledgeDB] 正在连接知识库: ${dbPath}`)

    try {
      await this._initDatabase(dbPath)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error(`[KnowledgeDB] 数据库初始化失败: ${message}`)
      this._disconnect()
      await this._deleteDbFiles(dbPath)

      try {
        await this._initDatabase(dbPath)
      } catch (retryErr: unknown) {
        const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr)
        logger.error(`[KnowledgeDB] 重建仍失败，知识库将不可用: ${retryMessage}`)
        return
      }
    }

    logger.info(
      `[KnowledgeDB] 连接成功: ${dbPath} vec=${this._vecVersion ?? 'n/a'} (${Math.round(performance.now() - started)}ms)`
    )
  }

  getDb(): AppDatabase {
    if (!this._db) {
      throw new Error('[KnowledgeDB] 知识库尚未连接，请先调用 connect()')
    }
    return this._db
  }

  /** 底层 better-sqlite3 实例（供原生 SQL / vec 探测） */
  getSqlite(): Database.Database {
    if (!this._sqlite) {
      throw new Error('[KnowledgeDB] 知识库尚未连接，请先调用 connect()')
    }
    return this._sqlite
  }

  getVecVersion(): string | null {
    return this._vecVersion
  }

  isConnected(): boolean {
    return this._sqlite !== null && this._db !== null
  }

  getCurrentPath(): string | null {
    return this._currentDbPath
  }

  disconnect(): void {
    this._disconnect()
  }

  private async _deleteDbFiles(dbPath: string): Promise<boolean> {
    const files = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]
    for (let attempt = 0; attempt < 8; attempt++) {
      let failed = false
      for (const file of files) {
        try {
          if (fs.existsSync(file)) fs.unlinkSync(file)
        } catch (e: unknown) {
          const err = e as { code?: string; message?: string }
          if (err?.code === 'EBUSY' || err?.code === 'EPERM') {
            failed = true
            continue
          }
          logger.error(`[KnowledgeDB] 删除损坏文件失败: ${file}`, err?.message)
          return false
        }
      }
      if (!failed) return true
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)))
    }
    return false
  }

  private loadSqliteVec(sqlite: Database.Database): string | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqliteVec = require('sqlite-vec') as { load: (db: Database.Database) => void }
      sqliteVec.load(sqlite)
      const row = sqlite.prepare('SELECT vec_version() AS v').get() as { v?: string } | undefined
      const version = row?.v != null ? String(row.v) : 'loaded'
      logger.info(`[KnowledgeDB] sqlite-vec 已加载，vec_version()=${version}`)
      return version
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error(`[KnowledgeDB] 加载 sqlite-vec 失败: ${message}`)
      return null
    }
  }

  private async _initDatabase(dbPath: string): Promise<void> {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const sqlite = new Database(dbPath)
    const vecVersion = this.loadSqliteVec(sqlite)

    try {
      sqlite.pragma('journal_mode = WAL')
      sqlite.pragma('synchronous = NORMAL')
      sqlite.pragma('foreign_keys = ON')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn(`[KnowledgeDB] pragma 设置失败: ${message}`)
    }

    try {
      await ensureKnowledgeSchema(sqlite, '[KnowledgeDB]')
    } catch (e: unknown) {
      try {
        sqlite.close()
      } catch {
        /* ignore */
      }
      throw e
    }

    this._sqlite = sqlite
    this._db = drizzle(sqlite) as unknown as AppDatabase
    this._currentDbPath = dbPath
    this._vecVersion = vecVersion
  }

  private _disconnect(): void {
    if (this._sqlite) {
      try {
        this._sqlite.close()
      } catch {
        /* ignore */
      }
      this._sqlite = null
    }
    this._db = null
    this._currentDbPath = null
    this._vecVersion = null
  }
}

/** 全局知识库连接单例 */
export const knowledgeConnectionManager = new KnowledgeConnectionManager()
