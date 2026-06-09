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

import { AppDatabase } from './types'
import { ExpoSqliteDriver, ExpoSqliteDatabase } from './drivers/expo-sqlite.driver'
import { MigrationService } from './migration.service'
import { EMBEDDED_AGENT_MIGRATIONS } from './embedded-agent-migrations'
import { withExpoAgentDatabaseLock } from './expo-agent-db.lock'

export type ExpoDatabaseInstallResult = {
  expoDb: ExpoSqliteDatabase
  drizzleDb: AppDatabase
  driver: ExpoSqliteDriver
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

/** 初始化 Expo SQLite：执行 Agent 迁移（影子索引已迁至 per-vault shadow_index_v2.db） */
export async function installExpoDatabaseSchema(expoDb: ExpoSqliteDatabase): Promise<{
  drizzleDb: AppDatabase
  driver: ExpoSqliteDriver
}> {
  const { drizzleDb, driver } = initExpoDatabase(expoDb)
  const migrationService = new MigrationService(drizzleDb, expoDb, '', EMBEDDED_AGENT_MIGRATIONS)
  await migrationService.runMigrations()
  await withExpoAgentDatabaseLock(drizzleDb, () => dropLegacyAgentShadowTables(expoDb))
  return { drizzleDb, driver }
}

/**
 * 保证 Agent 主库只初始化一次。
 * 避免 React Strict Mode / 热重载下并发 open + 迁移，在 Android 上触发 prepareSync NPE。
 */
export async function ensureExpoAgentDatabaseInstalled(
  openDatabase: () => Promise<ExpoSqliteDatabase>
): Promise<ExpoDatabaseInstallResult> {
  if (!expoAgentDatabaseInstall) {
    expoAgentDatabaseInstall = (async () => {
      const expoDb = await openDatabase()
      const { drizzleDb, driver } = await installExpoDatabaseSchema(expoDb)
      return { expoDb, drizzleDb, driver }
    })()
  }
  return expoAgentDatabaseInstall
}
