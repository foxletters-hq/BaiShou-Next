import { createClient, Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as path from 'path'
import * as fs from 'fs'
import { logger } from '@baishou/shared'

import type { AppDatabase } from './types'
import {
  SHADOW_INDEX_DB_FILENAME,
  ensureShadowIndexSchema
} from './shadow-index-schema.shared'

/**
 * 影子索引连接管理器 (ShadowIndexConnectionManager)
 *
 * 桌面端全局单库多 Vault 设计：
 *
 * 1. 所有 Vault 共享一个 `shadow_index_v2.db`
 *    路径：`{globalShadowDbDir}/shadow_index_v2.db`
 * 2. 连接时自动执行建表 / 迁移，确保表结构始终存在
 * 3. 崩溃恢复：若建表失败（文件损坏），删除文件并重新建库重建
 * 4. Vault 切换无需 close/open — 同一连接复用
 *
 * 表结构：
 * - `journals_index`  — 主影子索引表（含 `vault_name` 列）
 * - `journals_fts`    — FTS5 全文搜索虚拟表（content + tags）
 */
export class ShadowIndexConnectionManager {
  private _client: Client | null = null
  private _db: AppDatabase | null = null
  private _currentDbPath: string | null = null

  /**
   * 连接到全局影子索引数据库。
   *
   * @param globalShadowDbDir 全局 shadow 目录（非 per-vault）
   */
  async connect(globalShadowDbDir: string): Promise<void> {
    const dbPath = path.join(globalShadowDbDir, SHADOW_INDEX_DB_FILENAME)

    if (this._currentDbPath === dbPath && this._client && this._db) {
      logger.info(`[ShadowDB] 复用已有连接: ${dbPath}`)
      return
    }

    if (this._currentDbPath !== dbPath) {
      this._disconnect()
    }

    logger.info(`[ShadowDB] 正在连接影子索引库: ${dbPath}`)

    try {
      await this._initDatabase(dbPath)
    } catch (e: any) {
      logger.error(`[ShadowDB] 数据库初始化失败: ${e.message}`)
      this._disconnect()

      try {
        await this._initDatabase(dbPath)
      } catch (retryErr: any) {
        logger.error(`[ShadowDB] 重建仍失败，影子索引将不可用: ${retryErr.message}`)
        return
      }
    }

    logger.info(`[ShadowDB] 影子索引库连接成功: ${dbPath}`)
  }

  getDb(): AppDatabase {
    if (!this._db) {
      throw new Error('[ShadowDB] 影子索引数据库尚未连接，请先调用 connect()')
    }
    return this._db
  }

  getClient(): Client {
    if (!this._client) {
      throw new Error('[ShadowDB] 影子索引数据库尚未连接，请先调用 connect()')
    }
    return this._client
  }

  isConnected(): boolean {
    return this._client !== null && this._db !== null
  }

  disconnect(): void {
    this._disconnect()
  }

  private async _ensureHealthyFile(dbPath: string): Promise<void> {
    if (!fs.existsSync(dbPath)) return

    const probePath = dbPath + '.probe'
    let isCorrupt = false

    try {
      fs.copyFileSync(dbPath, probePath)

      let probe: Client | null = null
      try {
        probe = createClient({ url: `file:${probePath}` })
        const res = await probe.execute('PRAGMA quick_check;')
        const firstRow = res.rows[0]
        isCorrupt = !firstRow || firstRow['quick_check'] !== 'ok'
      } catch {
        isCorrupt = true
      } finally {
        try {
          probe?.close()
        } catch {}
      }
    } catch {
      return
    } finally {
      for (const f of [probePath, `${probePath}-wal`, `${probePath}-shm`]) {
        try {
          fs.unlinkSync(f)
        } catch {}
      }
    }

    if (!isCorrupt) return

    logger.warn(`[ShadowDB] 检测到损坏的影子索引库，正在清理: ${dbPath}`)
    let canDelete = true
    for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file)
      } catch (e: any) {
        logger.error(`[ShadowDB] 删除损坏文件失败: ${file}`, e.message)
        canDelete = false
      }
    }

    if (!canDelete) {
      throw new Error(
        `无法清理损坏的影子索引库: ${dbPath}。文件可能正被其他程序占用，请关闭后重试。`
      )
    }
  }

  private async _initDatabase(dbPath: string): Promise<void> {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    await this._ensureHealthyFile(dbPath)

    const client = createClient({ url: `file:${dbPath}` })

    try {
      await client.execute('PRAGMA journal_mode=WAL')
      await ensureShadowIndexSchema(client, '[ShadowDB]')
    } catch (e: any) {
      try {
        client.close()
      } catch {}
      throw e
    }

    this._client = client
    this._db = drizzle(client) as unknown as AppDatabase
    this._currentDbPath = dbPath
  }

  private _disconnect(): void {
    if (this._client) {
      this._client.close()
      this._client = null
    }
    this._db = null
    this._currentDbPath = null
  }
}

/**
 * 全局影子索引连接管理器单例。
 *
 * 在 Vault 初始化流程中调用 `shadowConnectionManager.connect(globalShadowDbDir)`。
 * 在 diary 相关 IPC 中通过 `shadowConnectionManager.getDb()` 获取 Shadow DB 实例。
 */
export const shadowConnectionManager = new ShadowIndexConnectionManager()
