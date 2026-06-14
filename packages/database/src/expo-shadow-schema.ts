import { ensureShadowIndexSchema } from './shadow-index-schema.shared'
import type { ExpoSqliteDatabase } from './drivers/expo-sqlite.driver'

/**
 * 移动端全局影子索引 schema（shadow_index_v2.db）
 */
export async function ensureExpoShadowIndexSchema(client: ExpoSqliteDatabase): Promise<void> {
  await ensureShadowIndexSchema(client, '[ExpoShadowSchema]')
}
