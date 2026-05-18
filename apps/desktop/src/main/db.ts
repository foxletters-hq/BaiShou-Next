import { app } from 'electron';
import { join } from 'path';
import { initNodeDatabase } from '@baishou/database';
import type { AppDatabase } from '@baishou/database/src/types';
import { logger } from '@baishou/shared';

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
let _appDb: AppDatabase | null = null;

let _appDbPath: string | null = null;

export function getAppDb(customBasePath?: string): AppDatabase {
  const agentDbPath = customBasePath
    ? join(customBasePath, 'baishou_agent.db')
    : join(app.getPath('userData'), 'baishou_agent.db');

  // 如果已有实例且路径匹配，直接返回
  if (_appDb && _appDbPath === agentDbPath) {
    return _appDb;
  }
  
  // 如果传入了 customBasePath 且与当前实例路径不同（说明之前被错误初始化），重置
  if (_appDb && customBasePath && _appDbPath !== agentDbPath) {
    logger.warn(`[DB] 检测到 DB 路径变更: ${_appDbPath} → ${agentDbPath}，正在重置连接...`);
    resetAppDb();
  }
  
  // 未初始化时创建新实例
  if (!_appDb) {
    logger.info(`[DB] Agent DB 初始化，路径: ${agentDbPath}`);
    _appDb = initNodeDatabase(agentDbPath);
    _appDbPath = agentDbPath;
  }
  
  return _appDb;
}

type ResetCallback = () => void;
const _resetCallbacks: Set<ResetCallback> = new Set();

/**
 * 注册数据库重置回调，用于解耦清理缓存的 Repository 和 Service
 */
export function onAppDbReset(callback: ResetCallback): () => void {
  _resetCallbacks.add(callback);
  return () => {
    _resetCallbacks.delete(callback);
  };
}

/**
 * 重置全局 Agent DB 实例
 * 在 ZIP 恢复等场景下，磁盘上的 DB 文件已被替换，
 * 必须关闭旧连接并创建新连接才能看到新文件数据
 */
export function resetAppDb(): void {
  if (_appDb) {
    try {
      const client = (_appDb as any)?.session?.client;
      if (client && typeof client.close === 'function') {
        client.close();
      }
    } catch {
      // 关闭旧连接失败不影响后续流程
    }
    _appDb = null;
    _appDbPath = null;

    // 触发所有已注册的重置回调，清除缓存的 Repo/Service
    for (const callback of _resetCallbacks) {
      try {
        callback();
      } catch (err) {
        logger.error('[DB] 执行数据库重置回调失败:', err);
      }
    }
  }
}

// 保留向后兼容的 appDb 导出（某些地方直接导入它）
// 注意：这个引用在模块加载时是懒初始化的 getter
export const appDb = {
  get instance() { return getAppDb(); }
} as unknown as AppDatabase;
