import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import {
  buildDiaryEmbeddingSourceId,
  DIARY_EMBED_GROUP_ID,
  isLegacyDiaryEmbeddingSourceId,
  LEGACY_DIARY_EMBED_GROUP_IDS
} from '@baishou/shared'
import { getAppDb } from '../db'
import { DesktopEmbeddingStorage } from '../ipc/rag.storage'

/** 删除旧版 numeric sourceId 与新版 scoped sourceId，避免重复向量残留 */
export async function deleteDiaryEmbeddingAliases(
  vaultId: string,
  diaryId: number | string
): Promise<void> {
  const storage = new DesktopEmbeddingStorage()
  const scoped = buildDiaryEmbeddingSourceId(vaultId, diaryId)
  const legacy = String(diaryId)
  await storage.deleteEmbeddingsBySource('diary', scoped)
  if (legacy !== scoped && isLegacyDiaryEmbeddingSourceId(legacy)) {
    await storage.deleteEmbeddingsBySource('diary', legacy)
  }
}

/** 批量嵌入前：清理本工作空间日记在旧 groupId 下的 legacy sourceId 向量 */
export async function purgeLegacyDiaryEmbeddingsForVault(
  vaultId: string,
  diaryIds: Array<number | string>
): Promise<number> {
  const numericIds = diaryIds
    .map((id) => String(id))
    .filter((id) => isLegacyDiaryEmbeddingSourceId(id))
  if (numericIds.length === 0) return 0

  const db = getAppDb()
  const result = await db
    .delete(memoryEmbeddingsTable)
    .where(
      and(
        eq(memoryEmbeddingsTable.sourceType, 'diary'),
        inArray(memoryEmbeddingsTable.sourceId, numericIds),
        inArray(memoryEmbeddingsTable.groupId, [...LEGACY_DIARY_EMBED_GROUP_IDS])
      )
    )
    .returning({ id: memoryEmbeddingsTable.id })

  if (result.length > 0) {
    console.info(`[DiaryEmbed] purged ${result.length} legacy diary vectors for vault ${vaultId}`)
  }
  return result.length
}

/** 一次性清理所有旧格式日记向量（numeric sourceId / 旧 groupId），避免多工作空间混用 */
export async function purgeAllLegacyDiaryEmbeddings(): Promise<number> {
  const db = getAppDb()
  const result = await db
    .delete(memoryEmbeddingsTable)
    .where(
      and(
        eq(memoryEmbeddingsTable.sourceType, 'diary'),
        or(
          inArray(memoryEmbeddingsTable.groupId, [...LEGACY_DIARY_EMBED_GROUP_IDS]),
          sql`${memoryEmbeddingsTable.sourceId} NOT LIKE '%#%'`
        )
      )
    )
    .returning({ id: memoryEmbeddingsTable.id })

  if (result.length > 0) {
    console.info(`[DiaryEmbed] purged ${result.length} global legacy diary vectors`)
  }
  return result.length
}

export async function countDiaryEmbeddingsForVault(vaultId: string): Promise<number> {
  const db = getAppDb()
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(memoryEmbeddingsTable)
    .where(
      and(
        eq(memoryEmbeddingsTable.sourceType, 'diary'),
        eq(memoryEmbeddingsTable.groupId, DIARY_EMBED_GROUP_ID),
        eq(memoryEmbeddingsTable.vaultId, vaultId)
      )
    )
  return Number(rows[0]?.count ?? 0)
}
