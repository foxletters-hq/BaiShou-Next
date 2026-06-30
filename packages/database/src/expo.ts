import { drizzle } from 'drizzle-orm/expo-sqlite'
// WE MUST explicitly export to avoid connection.manager triggering better-sqlite3
export * from './schema/summaries'
export * from './schema/agent-sessions'
export * from './schema/agent-messages'
export * from './schema/agent-parts'
export * from './schema/agent-assistants'
export * from './schema/compression-snapshots'
export * from './schema/vectors'
export * from './schema/system-settings'
export * from './schema/shadow-index'

export * from './repositories/diary.repository'
export * from './repositories/agent.repository'
export * from './repositories/session.repository'
export * from './repositories/assistant.repository'
export * from './repositories/message.repository'
export * from './repositories/settings.repository'
export * from './repositories/hybrid-search.repository'
export * from './repositories/snapshot.repository'
export * from './repositories/settings.defaults'
export * from './repositories/user-profile.repository'
export * from './repositories/prompt-shortcut.repository'
export * from './repositories/shadow-index.repository'
export * from './repositories/summary.repository'
export * from './repositories/summary.repository.impl'

export * from './drivers/vec-capability'
export * from './drivers/expo-sqlite-vec.loader'
export type { ExpoSqliteDatabase } from './drivers/expo-sqlite.driver'

import { AppDatabase } from './types'
import { ExpoSqliteDriver, ExpoSqliteDatabase } from './drivers/expo-sqlite.driver'
import { loadExpoSqliteVecExtension } from './drivers/expo-sqlite-vec.loader'
import { MigrationService } from './migration.service'
import { EMBEDDED_AGENT_MIGRATIONS } from './embedded-agent-migrations'
import { withExpoAgentDatabaseLock, waitForExpoAgentDatabaseIdle } from './expo-agent-db.lock'
import { logger } from '@baishou/shared'
export * from './migration-context'
export * from './sqlite-corruption.util'
export * from './expo-agent-db.recovery'

export type ExpoDatabaseInstallResult = {
  expoDb: ExpoSqliteDatabase
  drizzleDb: AppDatabase
  driver: ExpoSqliteDriver
  sqliteVecLoaded: boolean
  sqliteVecLoadReason?: string
}

let expoAgentDatabaseInstall: Promise<ExpoDatabaseInstallResult> | null = null

/** 旧版将影子索引建在 Agent 主库中；迁移至 per-vault 文件后清理遗留表 */
async function dropLegacyAgentShadowTables(expoDb: ExpoSqliteDatabase): Promise<void> {
  try {
    await expoDb.execAsync('DROP TABLE IF EXISTS journals_fts')
    await expoDb.execAsync('DROP TABLE IF EXISTS journals_index')
  } catch (e) {
    console.warn('[ExpoSchema] drop legacy shadow tables skipped:', e)
  }
}

// 特别为 Expo 环境提供的原生依赖解耦
export function initExpoDatabase(expoDb: ExpoSqliteDatabase): {
  drizzleDb: AppDatabase
  driver: ExpoSqliteDriver
} {
  const drizzleDb = drizzle(expoDb as any) as unknown as AppDatabase
  const driver = new ExpoSqliteDriver(expoDb)
  return { drizzleDb, driver }
}

export type OpenExpoAgentDatabaseFn = (options?: {
  useNewConnection?: boolean
}) => Promise<ExpoSqliteDatabase>

/** 初始化 Expo SQLite：执行 Agent 迁移（影子索引已迁至 per-vault shadow_index_v2.db） */
export async function installExpoDatabaseSchema(expoDb: ExpoSqliteDatabase): Promise<{
  drizzleDb: AppDatabase
  driver: ExpoSqliteDriver
}> {
  // 须在 drizzle() 之前完成迁移：drizzle-orm 会占用 prepareSync，与 getAllAsync/runAsync 混用会在 Android NPE
  const migrationService = new MigrationService(
    expoDb as unknown as AppDatabase,
    expoDb,
    '',
    EMBEDDED_AGENT_MIGRATIONS
  )
  await migrationService.runMigrations()
  const { drizzleDb, driver } = initExpoDatabase(expoDb)
  await withExpoAgentDatabaseLock(drizzleDb, () => dropLegacyAgentShadowTables(expoDb))
  return { drizzleDb, driver }
}

/**
 * 保证 Agent 主库只初始化一次。
 * 避免 React Strict Mode / 热重载下并发 open + 迁移，在 Android 上触发 prepareSync NPE。
 */
async function runExpoAgentDatabaseInstall(
  openDatabase: OpenExpoAgentDatabaseFn
): Promise<ExpoDatabaseInstallResult> {
  const expoDb = await openDatabase()
  const { drizzleDb, driver } = await installExpoDatabaseSchema(expoDb)
  const vecLoad = await loadExpoSqliteVecExtension(expoDb)
  if (vecLoad.loaded) {
    logger.info('[VectorSearch] expo sqlite-vec extension loaded on agent database')
  } else {
    logger.warn(
      '[VectorSearch] expo sqlite-vec not loaded; vector search will use JS fallback.',
      vecLoad.reason
    )
  }
  return {
    expoDb,
    drizzleDb,
    driver,
    sqliteVecLoaded: vecLoad.loaded,
    sqliteVecLoadReason: vecLoad.reason
  }
}

export async function ensureExpoAgentDatabaseInstalled(
  openDatabase: OpenExpoAgentDatabaseFn
): Promise<ExpoDatabaseInstallResult> {
  if (!expoAgentDatabaseInstall) {
    expoAgentDatabaseInstall = (async () => {
      try {
        return await runExpoAgentDatabaseInstall(openDatabase)
      } catch (firstError) {
        logger.warn(
          '[ExpoDB] Agent DB 首次初始化失败，尝试 useNewConnection 重试（常见于开发热重载）',
          firstError
        )
        try {
          return await runExpoAgentDatabaseInstall((options) =>
            openDatabase({ ...options, useNewConnection: true })
          )
        } catch (retryError) {
          expoAgentDatabaseInstall = null
          throw retryError
        }
      }
    })()
  }
  return expoAgentDatabaseInstall
}

/**
 * 解除 JS 侧 Agent 主库单例引用，供全量归档恢复后重新 open。
 * 不调用 closeAsync：Android expo-sqlite 在 sqlite3_close 会原生崩溃（与影子库 disconnect 同理）。
 */
export async function releaseExpoAgentDatabaseInstall(): Promise<void> {
  await waitForExpoAgentDatabaseIdle()
  expoAgentDatabaseInstall = null
}

/** 归档导入完成后异步补建 Agent 消息 FTS 历史索引 */
export async function backfillExpoAgentMessagesFts(
  drizzleDb: AppDatabase,
  expoDb: ExpoSqliteDatabase
): Promise<void> {
  const migrationService = new MigrationService(drizzleDb, expoDb, '', EMBEDDED_AGENT_MIGRATIONS)
  await migrationService.backfillAgentMessagesFts()
}
