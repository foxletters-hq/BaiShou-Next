import { app } from 'electron'
import { join } from 'path'
import { initNodeDatabase, AppDatabase } from '@baishou/database-desktop'
import { logger } from '@baishou/shared'
import { renameSync, existsSync } from 'fs'

/**
 * 全局 Agent DB（baishou_agent.db）— 懒加载单例
 *
 * 架构说明（双库分离）：
 * - Agent DB 是全局共用的：所有 Vault 共享同一个 Agent 库
 * - 路径存放在 Electron 的 userData 目录下，与 Vault 物理路径完全隔离
 * - 使用懒加载：只有在 app.whenReady() 之后首次调用 getAppDb() 时才实际创建
 *
 * 影子索引库（shadow_index.db）是 per-vault 的，
 * 由 ShadowIndexConnectionManager 在 vault.ipc.ts 中管理。
 */
let _appDb: AppDatabase | null = null

let _appDbPath: string | null = null

/**
 * 处理数据库文件物理损坏的自动恢复
 */
function handleMalformedDb(dbPath: string, err: any) {
  logger.error(`[DB] 检测到数据库损坏 (malformed)，启动自动修复。错误信息: ${err?.message || err}`)

  // 确保安全重置当前连结并清除外部的 Service/Repo 缓存
  resetAppDb()

  const timestamp = Date.now()
  const corruptedPath = `${dbPath}.corrupted.${timestamp}`

  try {
    if (existsSync(dbPath)) {
      renameSync(dbPath, corruptedPath)
      logger.warn(`[DB] 已将损坏的数据库重命名为: ${corruptedPath}`)
    }

    // 同时重命名其 WAL 与 SHM 附属缓存文件，杜绝残留坏帧
    const walPath = `${dbPath}-wal`
    if (existsSync(walPath)) {
      renameSync(walPath, `${walPath}.corrupted.${timestamp}`)
      logger.warn(`[DB] 已将损坏的 WAL 文件重命名`)
    }

    const shmPath = `${dbPath}-shm`
    if (existsSync(shmPath)) {
      renameSync(shmPath, `${shmPath}.corrupted.${timestamp}`)
      logger.warn(`[DB] 已将损坏的 SHM 文件重命名`)
    }
  } catch (fsErr) {
    logger.error('[DB] 重命名损坏的数据库文件失败:', fsErr as any)
  }
}

export function getAppDb(customBasePath?: string): AppDatabase {
  const agentDbPath = customBasePath
    ? join(customBasePath, 'baishou_agent.db')
    : _appDbPath || join(app.getPath('userData'), 'baishou_agent.db')

  // 如果已有实例且路径匹配，直接返回
  if (_appDb && _appDbPath === agentDbPath) {
    return _appDb
  }

  // 如果传入了 customBasePath 且与当前实例路径不同（说明之前被错误初始化），重置
  if (_appDb && customBasePath && _appDbPath !== agentDbPath) {
    logger.warn(`[DB] 检测到 DB 路径变更: ${_appDbPath} → ${agentDbPath}，正在重置连接...`)
    resetAppDb()
  }

  // 未初始化时创建新实例
  if (!_appDb) {
    logger.info(`[DB] Agent DB 初始化，路径: ${agentDbPath}`)
    try {
      _appDb = initNodeDatabase(agentDbPath, (err) => {
        handleMalformedDb(agentDbPath, err)
      })
      _appDbPath = agentDbPath

      // 运行一次快速完整性校验以发现损坏
      const client = (_appDb as any)?.session?.client
      if (client && typeof client.pragma === 'function') {
        try {
          const rows = client.pragma('integrity_check')
          if (rows && rows[0] && rows[0].integrity_check !== 'ok') {
            throw new Error(`integrity_check returned: ${rows[0].integrity_check}`)
          }
        } catch (pragmaErr: any) {
          if (pragmaErr.message?.includes('unknown function')) {
            logger.warn('[DB] 初始化自检遇到未知函数（例如向量扩展未加载），跳过物理检查。')
          } else {
            throw pragmaErr
          }
        }
      }
    } catch (err: any) {
      if (
        err?.message?.includes('malformed') ||
        err?.code === 'SQLITE_CORRUPT' ||
        err?.message?.includes('database disk image is malformed')
      ) {
        handleMalformedDb(agentDbPath, err)
        // 自动清除损毁数据库后，重新初始化全新空白数据库
        logger.info(`[DB] 重新初始化全新的数据库...`)
        _appDb = initNodeDatabase(agentDbPath, (err2) => {
          handleMalformedDb(agentDbPath, err2)
        })
        _appDbPath = agentDbPath
      } else {
        throw err // 如果是其它原因的初始化错误，则原样抛出
      }
    }
  }

  return _appDb
}

type ResetCallback = () => void
const _resetCallbacks: Set<ResetCallback> = new Set()

/**
 * 注册数据库重置回调，用于解耦清理缓存的 Repository 和 Service
 */
export function onAppDbReset(callback: ResetCallback): () => void {
  _resetCallbacks.add(callback)
  return () => {
    _resetCallbacks.delete(callback)
  }
}

/**
 * 重置全局 Agent DB 实例
 * 在 ZIP 恢复等场景下，磁盘上的 DB 文件已被替换，
 * 必须关闭旧连接并创建新连接才能看到新文件数据
 */
export function getAppDbPath(): string | null {
  return _appDbPath
}

export function resetAppDb(): void {
  if (_appDb) {
    try {
      const client = (_appDb as any)?.session?.client
      if (client && typeof client.close === 'function') {
        client.close()
      }
    } catch {
      // 关闭旧连接失败不影响后续流程
    }
    _appDb = null

    // 触发所有已注册的重置回调，清除缓存的 Repo/Service
    for (const callback of _resetCallbacks) {
      try {
        callback()
      } catch (err) {
        logger.error('[DB] 执行数据库重置回调失败:', err as any)
      }
    }
  }
}

// 保留向后兼容的 appDb 导出（某些地方直接导入它）
// 注意：这个引用在模块加载时是懒初始化的 getter
export const appDb = {
  get instance() {
    return getAppDb()
  }
} as unknown as AppDatabase
