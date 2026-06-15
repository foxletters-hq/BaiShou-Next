import { bundledExtensions } from 'expo-sqlite'
import { logger } from '@baishou/shared'
import type { ExpoSqliteDatabase } from './expo-sqlite.driver'

export type SqliteVecLoadResult = {
  loaded: boolean
  reason?: string
}

/**
 * 在 Expo SQLite 连接上加载预置的 sqlite-vec 扩展。
 * 需在 app.json 中启用 expo-sqlite 插件选项 withSQLiteVecExtension，并重编开发版 APK。
 */
export async function loadExpoSqliteVecExtension(
  expoDb: ExpoSqliteDatabase
): Promise<SqliteVecLoadResult> {
  const loadExtensionAsync = expoDb.loadExtensionAsync
  if (typeof loadExtensionAsync !== 'function') {
    return {
      loaded: false,
      reason: 'expo-sqlite loadExtensionAsync is unavailable (rebuild dev client required)'
    }
  }

  const extension = bundledExtensions['sqlite-vec']
  if (!extension?.libPath) {
    return {
      loaded: false,
      reason:
        'sqlite-vec bundled extension missing — set expo-sqlite plugin withSQLiteVecExtension: true and rebuild'
    }
  }

  try {
    await loadExtensionAsync.call(expoDb, extension.libPath, extension.entryPoint)
    return { loaded: true }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    logger.warn('[VectorSearch] Failed to load expo sqlite-vec extension:', reason)
    return { loaded: false, reason }
  }
}
