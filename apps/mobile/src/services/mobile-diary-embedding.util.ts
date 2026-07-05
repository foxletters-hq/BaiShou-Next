import {
  buildDiaryEmbeddingGroupId,
  buildDiaryEmbeddingSourceId,
  isLegacyDiaryEmbeddingSourceId,
  LEGACY_DIARY_EMBED_GROUP_IDS
} from '@baishou/shared'
import type { SqliteHybridSearchRepository } from '@baishou/database'

const HYBRID_SEARCH_TABLE = 'memory_embeddings'

type RawSqlClient = {
  execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
}

function legacyGroupPlaceholders(): string {
  return LEGACY_DIARY_EMBED_GROUP_IDS.map(() => '?').join(', ')
}

/** 删除旧版 numeric sourceId 与新版 scoped sourceId，避免重复向量残留 */
export async function deleteDiaryEmbeddingAliases(
  hsRepo: SqliteHybridSearchRepository,
  vaultName: string,
  diaryId: number | string
): Promise<void> {
  const scoped = buildDiaryEmbeddingSourceId(vaultName, diaryId)
  const legacy = String(diaryId)
  await hsRepo.deleteEmbeddingsBySource('diary', scoped)
  if (legacy !== scoped && isLegacyDiaryEmbeddingSourceId(legacy)) {
    await hsRepo.deleteEmbeddingsBySource('diary', legacy)
  }
}

/** 批量嵌入前：清理本工作空间在旧 groupId 下的 legacy 向量 */
export async function purgeLegacyDiaryEmbeddingsForVault(
  rawClient: RawSqlClient | undefined,
  vaultName: string,
  diaryIds: Array<number | string>
): Promise<number> {
  const numericIds = diaryIds
    .map((id) => String(id))
    .filter((id) => isLegacyDiaryEmbeddingSourceId(id))
  if (numericIds.length === 0 || !rawClient?.execute) return 0

  const result = await rawClient.execute({
    sql: `DELETE FROM ${HYBRID_SEARCH_TABLE}
          WHERE source_type = 'diary'
            AND source_id IN (${numericIds.map(() => '?').join(', ')})
            AND group_id IN (${legacyGroupPlaceholders()})`,
    args: [...numericIds, ...LEGACY_DIARY_EMBED_GROUP_IDS]
  })
  return Number((result as { rowsAffected?: number }).rowsAffected ?? 0)
}

/** 一次性清理所有旧格式日记向量 */
export async function purgeAllLegacyDiaryEmbeddings(
  rawClient: RawSqlClient | undefined
): Promise<number> {
  if (!rawClient?.execute) return 0

  const result = await rawClient.execute({
    sql: `DELETE FROM ${HYBRID_SEARCH_TABLE}
          WHERE source_type = 'diary'
            AND (
              group_id IN (${legacyGroupPlaceholders()})
              OR source_id NOT LIKE '%#%'
            )`,
    args: [...LEGACY_DIARY_EMBED_GROUP_IDS]
  })
  return Number((result as { rowsAffected?: number }).rowsAffected ?? 0)
}

export async function countDiaryEmbeddingsForVault(
  rawClient: RawSqlClient | undefined,
  vaultName: string
): Promise<number> {
  if (!rawClient?.execute) return 0
  const groupId = buildDiaryEmbeddingGroupId(vaultName)
  const result = await rawClient.execute({
    sql: `SELECT COUNT(*) as count FROM ${HYBRID_SEARCH_TABLE}
          WHERE source_type = 'diary' AND group_id = ?`,
    args: [groupId]
  })
  const row = result.rows?.[0] as Record<string, number> | undefined
  return Number(row?.count ?? 0)
}
