import { app } from 'electron';
import { join } from 'path';
import { initNodeDatabase } from '@baishou/database';
import type { AppDatabase } from '@baishou/database';
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

export function getAppDb(): AppDatabase {
  if (!_appDb) {
    const agentDbPath = join(app.getPath('userData'), 'baishou_agent.db');
    logger.info('[DB] Agent DB 路径:', agentDbPath);
    _appDb = initNodeDatabase(agentDbPath);
  }
  return _appDb;
}

// 保留向后兼容的 appDb 导出（某些地方直接导入它）
// 注意：这个引用在模块加载时是懒初始化的 getter
export const appDb = {
  get instance() { return getAppDb(); }
} as unknown as AppDatabase;
