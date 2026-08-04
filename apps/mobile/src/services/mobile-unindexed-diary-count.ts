import {
  buildDiaryEmbeddingSourceId,
  filterUnindexedDiaries,
  type DiaryMeta
} from '@baishou/shared'
import {
  loadEmbeddedDiaryIndex,
  resolveVaultScope,
  type MobileRagServiceDeps
} from './mobile-rag-core.helpers'

/** 当前活跃仓待嵌入日记篇数（底栏「待嵌入」） */
export async function countUnindexedDiariesForActiveVault(
  deps: MobileRagServiceDeps
): Promise<number> {
  const vaultScope = await resolveVaultScope(deps)
  const vaultId = await vaultScope.resolveActiveVaultId()
  const diaries = (await deps.diaryService.listAll({ limit: 10000 })) as DiaryMeta[]
  if (!diaries.length) return 0
  const { embeddedIds, embeddedUpdatedAtMap } = await loadEmbeddedDiaryIndex(deps, vaultId)
  const unindexed = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap, {
    resolveSourceId: (meta) => buildDiaryEmbeddingSourceId(vaultId, meta.id as number | string)
  })
  return unindexed.length
}
