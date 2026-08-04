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

/**
 * 当前活跃仓「待嵌入」日记篇数（未索引或内容已更新）。
 * 日记底栏用此语义，而不是仅统计 embed jobs 队列。
 */
export async function countUnindexedDiariesForActiveVault(): Promise<number> {
  const { vaultService, resolveActiveVaultId } = await import('../ipc/vault.ipc')
  const { getDiaryManagerForVault } = await import('./diary-vault.factory')
  const {
    buildDiaryEmbeddingSourceId,
    filterUnindexedDiaries
  } = await import('@baishou/shared')

  const vault = vaultService.getActiveVault()
  if (!vault) return 0
  const vaultId = resolveActiveVaultId()
  const diaryManager = await getDiaryManagerForVault(vault.name)
  const diaries = await diaryManager.listAll({ limit: 10000 })
  if (diaries.length === 0) return 0

  const db = getAppDb()
  const existingRows = await db
    .select({
      sourceId: memoryEmbeddingsTable.sourceId,
      maxUpdatedAt: sql<number>`MAX(CAST(json_extract(${memoryEmbeddingsTable.metadataJson}, '$.updated_at') AS INTEGER))`
    })
    .from(memoryEmbeddingsTable)
    .where(
      and(
        eq(memoryEmbeddingsTable.sourceType, 'diary'),
        eq(memoryEmbeddingsTable.groupId, DIARY_EMBED_GROUP_ID),
        eq(memoryEmbeddingsTable.vaultId, vaultId)
      )
    )
    .groupBy(memoryEmbeddingsTable.sourceId)

  const embeddedIds = new Set(existingRows.map((row) => row.sourceId))
  const embeddedUpdatedAtMap = new Map<string, number>()
  for (const row of existingRows) {
    if (row.sourceId && Number.isFinite(row.maxUpdatedAt)) {
      embeddedUpdatedAtMap.set(row.sourceId, Number(row.maxUpdatedAt))
    }
  }

  const unindexed = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap, {
    resolveSourceId: (meta) => buildDiaryEmbeddingSourceId(vaultId, meta.id as number | string)
  })
  return unindexed.length
}
