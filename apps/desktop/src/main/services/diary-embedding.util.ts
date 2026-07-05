import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import {
  buildDiaryEmbeddingGroupId,
  buildDiaryEmbeddingSourceId,
  isLegacyDiaryEmbeddingSourceId,
  LEGACY_DIARY_EMBED_GROUP_IDS
} from '@baishou/shared'
import { getAppDb } from '../db'
import { DesktopEmbeddingStorage } from '../ipc/rag.storage'

/** 删除旧版 numeric sourceId 与新版 scoped sourceId，避免重复向量残留 */
export async function deleteDiaryEmbeddingAliases(
  vaultName: string,
  diaryId: number | string
): Promise<void> {
  const storage = new DesktopEmbeddingStorage()
  const scoped = buildDiaryEmbeddingSourceId(vaultName, diaryId)
  const legacy = String(diaryId)
  await storage.deleteEmbeddingsBySource('diary', scoped)
  if (legacy !== scoped && isLegacyDiaryEmbeddingSourceId(legacy)) {
    await storage.deleteEmbeddingsBySource('diary', legacy)
  }
}

/** 批量嵌入前：清理本工作空间日记在旧 groupId 下的 legacy sourceId 向量 */
export async function purgeLegacyDiaryEmbeddingsForVault(
  vaultName: string,
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
    console.info(`[DiaryEmbed] purged ${result.length} legacy diary vectors for vault ${vaultName}`)
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

export async function countDiaryEmbeddingsForVault(vaultName: string): Promise<number> {
  const db = getAppDb()
  const groupId = buildDiaryEmbeddingGroupId(vaultName)
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(memoryEmbeddingsTable)
    .where(
      and(eq(memoryEmbeddingsTable.sourceType, 'diary'), eq(memoryEmbeddingsTable.groupId, groupId))
    )
  return Number(rows[0]?.count ?? 0)
}
