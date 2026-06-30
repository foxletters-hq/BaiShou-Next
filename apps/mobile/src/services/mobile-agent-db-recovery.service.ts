import * as SQLite from 'expo-sqlite'
import {
  releaseExpoAgentDatabaseInstall,
  ensureExpoAgentDatabaseInstalled,
  type OpenExpoAgentDatabaseFn
} from '@baishou/database/expo'
import type { IFileSystem } from '@baishou/core-mobile'
import { logger } from '@baishou/shared'
import { getAppDocumentDirectory } from './mobile-app-paths'
export {
  mobileAgentDbRecovery,
  MobileAgentDbRecoveryCoordinator
} from './mobile-agent-db-recovery.coordinator'

export const MOBILE_AGENT_DB_NAME = 'baishou_next_mobile.db'

export async function quarantineMobileAgentDatabase(fileSystem: IFileSystem): Promise<string> {
  const sqliteDir = `${getAppDocumentDirectory()}SQLite/`
  const basePath = `${sqliteDir}${MOBILE_AGENT_DB_NAME}`
  const timestamp = Date.now()
  const quarantineBase = `${sqliteDir}${MOBILE_AGENT_DB_NAME}.corrupted.${timestamp}`

  for (const suffix of ['', '-wal', '-shm']) {
    const src = `${basePath}${suffix}`
    if (!(await fileSystem.exists(src))) continue
    const dest = `${quarantineBase}${suffix}`
    try {
      await fileSystem.rename(src, dest)
      logger.warn(`[AgentDbRecovery] 已隔离损坏文件: ${src} → ${dest}`)
    } catch (e) {
      logger.error(`[AgentDbRecovery] 隔离文件失败 (${src}):`, e as Error)
      try {
        await fileSystem.unlink(src)
        logger.warn(`[AgentDbRecovery] 已删除无法重命名的损坏文件: ${src}`)
      } catch (unlinkErr) {
        logger.error(`[AgentDbRecovery] 删除损坏文件失败 (${src}):`, unlinkErr as Error)
      }
    }
  }

  try {
    await SQLite.deleteDatabaseAsync(MOBILE_AGENT_DB_NAME)
  } catch {
    // ignore — 文件可能已被 rename / unlink
  }

  if (await fileSystem.exists(basePath)) {
    throw new Error(`无法隔离损坏的 Agent 数据库: ${basePath}`)
  }

  return quarantineBase
}

export async function rebuildMobileAgentDatabase(
  fileSystem: IFileSystem,
  openDatabase: OpenExpoAgentDatabaseFn
) {
  await releaseExpoAgentDatabaseInstall()
  await quarantineMobileAgentDatabase(fileSystem)
  return ensureExpoAgentDatabaseInstalled(openDatabase)
}
