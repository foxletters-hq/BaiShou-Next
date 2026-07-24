import i18n from 'i18next'
import { AIProviderRegistry, EmbeddingAdapter, HybridSearchService } from '@baishou/ai'
import {
  diaryDateToSourceCreatedSeconds,
  buildDiaryEmbeddingGroupId,
  buildDiaryEmbeddingSourceId,
  clearRagDiaryEmbedFailure,
  hasRagDiaryEmbedFailure,
  isRagMemoryEnabled,
  markRagDiaryEmbedFailure,
  buildDiaryEmbeddingTagPrefix,
  type RagConfig
} from '@baishou/shared'
import { SqliteHybridSearchRepository } from '@baishou/database'
import type { SettingsManagerService, DiaryService } from '@baishou/core-mobile'
import { abortableMobileRagDelay, mobileRagOperationControl } from './mobile-rag-operation-control'
import { deleteDiaryEmbeddingAliases } from './mobile-diary-embedding.util'
import type { MobileRagVaultScope } from './mobile-rag-vault-scope'
import { patchCachedMobileRagState } from './mobile-rag-runtime-cache'

const HYBRID_SEARCH_TABLE = 'memory_embeddings'
const PREPARE_DIMENSION_MAX_ATTEMPTS = 3

type StoredRagConfig = RagConfig & { totalEmbeddings?: number }

export type RagProgressCallback = (progress: {
  current: number
  total: number
  status: string
}) => void

type RagProgressOperationType = 'batchEmbed' | 'reembed' | 'migration'

export interface MobileRagServiceDeps {
  settingsManager: SettingsManagerService
  diaryService: DiaryService
  hsRepo: SqliteHybridSearchRepository
  hybridSearchService: HybridSearchService
  registry: AIProviderRegistry
  rawSqlClient: unknown
  vaultScope?: MobileRagVaultScope
}

export type EmbedDiaryEntryParams = {
  diaryId: number
  content: string
  tags: string[]
  date: Date | string
  updatedAt: Date
  groupId?: string
  vaultName?: string
}

export type EmbedDiaryEntryOptions = {
  adapter?: EmbeddingAdapter
  skipIndexPrep?: boolean
  skipRagEnabledCheck?: boolean
}

export type ControlledDiaryBatchEmbedResult = {
  embedded: number
  failed: number
  loadSkipped?: number
  total: number
  skipped: boolean
  skipReason?: string
}

function defaultVaultScope(): MobileRagVaultScope {
  return {
    resolveActiveVaultName: async () => 'Personal',
    listVaultNames: async () => ['Personal']
  }
}

export async function resolveVaultScope(deps: MobileRagServiceDeps): Promise<MobileRagVaultScope> {
  return deps.vaultScope ?? defaultVaultScope()
}

export function diaryVaultListFilterSql(vaultGroupId: string): { clause: string; args: string[] } {
  return {
    clause: `(source_type != 'diary' OR group_id = ?)`,
    args: [vaultGroupId]
  }
}

function broadcastRagProgress(
  type: RagProgressOperationType,
  progress: { current: number; total: number; status?: string }
): void {
  patchCachedMobileRagState({
    isRunning: true,
    type,
    progress: progress.current,
    total: progress.total,
    statusText: progress.status ?? ''
  })
}

export function chainRagProgressCallback(
  type: RagProgressOperationType,
  onProgress?: RagProgressCallback
): RagProgressCallback | undefined {
  if (!onProgress) {
    return (progress) => broadcastRagProgress(type, progress)
  }
  return (progress) => {
    onProgress(progress)
    broadcastRagProgress(type, progress)
  }
}

async function countEmbeddingsInDb(deps: MobileRagServiceDeps): Promise<number> {
  const client = deps.rawSqlClient as {
    execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
  }
  if (!client?.execute) return 0

  const result = await client.execute({
    sql: `SELECT COUNT(*) as count FROM ${HYBRID_SEARCH_TABLE}`,
    args: []
  })
  const row = result.rows?.[0] as Record<string, number> | number[] | undefined
  return Number((row && typeof row === 'object' && !Array.isArray(row) ? row.count : row?.[0]) ?? 0)
}

/** 批量嵌入结束后一次性更新 rag_config（向量总数 + 失败标记），避免多次写入竞态。 */
export async function finalizeBatchEmbedRagConfig(
  deps: MobileRagServiceDeps,
  batchFailed: boolean
): Promise<number> {
  const totalCount = await countEmbeddingsInDb(deps)
  const ragConfig = (await deps.settingsManager.get<StoredRagConfig>('rag_config')) || {
    ragEnabled: true,
    ragTopK: 20,
    ragSimilarityThreshold: 0.4
  }

  let nextConfig: StoredRagConfig = { ...ragConfig, totalEmbeddings: totalCount }
  if (batchFailed) {
    nextConfig = markRagDiaryEmbedFailure(nextConfig)
  } else if (hasRagDiaryEmbedFailure(nextConfig)) {
    nextConfig = clearRagDiaryEmbedFailure(nextConfig)
  }

  await deps.settingsManager.set('rag_config', nextConfig)
  return totalCount
}

export async function prepareMobileEmbeddingIndex(
  deps: MobileRagServiceDeps,
  adapter: EmbeddingAdapter
): Promise<number> {
  const globalModels =
    (await deps.settingsManager.get<{ globalEmbeddingDimension?: number }>('global_models')) || {}
  let dimension = Number(globalModels.globalEmbeddingDimension || 0)

  if (dimension <= 0) {
    let vector: number[] | null = null
    for (let attempt = 1; attempt <= PREPARE_DIMENSION_MAX_ATTEMPTS; attempt++) {
      vector = await adapter.embedQuery('hi')
      if (vector?.length) break
      if (attempt < PREPARE_DIMENSION_MAX_ATTEMPTS) {
        await abortableMobileRagDelay(attempt * 1000, mobileRagOperationControl)
      }
    }
    if (!vector?.length) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.mobile.rag.core.helpers.L166',
          '嵌入 API 未返回有效向量'
        )
      )
    }
    dimension = vector.length
    globalModels.globalEmbeddingDimension = dimension
    await deps.settingsManager.set('global_models', globalModels)
  }

  await deps.hsRepo.initVectorIndex(dimension)
  return dimension
}

export async function resolveEmbeddingAdapter(
  deps: MobileRagServiceDeps
): Promise<EmbeddingAdapter | null> {
  const providers = (await deps.settingsManager.get<any[]>('ai_providers')) || []
  const globalModels = await deps.settingsManager.get<any>('global_models')
  const embeddingProviderId = globalModels?.globalEmbeddingProviderId
  const embeddingModelId = globalModels?.globalEmbeddingModelId

  if (!embeddingProviderId || !embeddingModelId) return null

  const embeddingProviderConfig = providers.find((p: any) => p.id === embeddingProviderId)
  if (!embeddingProviderConfig) return null

  const embeddingProvider = deps.registry.getOrUpdateProvider(embeddingProviderConfig)
  return new EmbeddingAdapter(embeddingProvider, embeddingModelId, deps.hsRepo)
}

export async function loadEmbeddedDiaryIndex(
  deps: MobileRagServiceDeps,
  vaultName: string
): Promise<{
  embeddedIds: Set<string>
  embeddedUpdatedAtMap: Map<string, number>
}> {
  const embeddedIds = new Set<string>()
  const embeddedUpdatedAtMap = new Map<string, number>()
  const client = deps.rawSqlClient as {
    execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
  }
  if (!client?.execute) {
    return { embeddedIds, embeddedUpdatedAtMap }
  }

  const groupId = buildDiaryEmbeddingGroupId(vaultName)
  const result = await client.execute({
    sql: `SELECT source_id as sourceId, metadata_json as metadataJson FROM ${HYBRID_SEARCH_TABLE} WHERE source_type = 'diary' AND group_id = ?`,
    args: [groupId]
  })

  for (const row of (result.rows || []) as Array<{
    sourceId?: string | number
    metadataJson?: string
  }>) {
    if (row.sourceId == null) continue
    const sourceId = String(row.sourceId)
    embeddedIds.add(sourceId)
    if (!row.metadataJson) continue
    try {
      const meta = JSON.parse(row.metadataJson) as { updated_at?: number }
      if (typeof meta.updated_at === 'number') {
        const currentMax = embeddedUpdatedAtMap.get(sourceId) ?? 0
        if (meta.updated_at > currentMax) {
          embeddedUpdatedAtMap.set(sourceId, meta.updated_at)
        }
      }
    } catch {
      /* ignore malformed metadata */
    }
  }

  return { embeddedIds, embeddedUpdatedAtMap }
}

export async function embedDiaryEntry(
  deps: MobileRagServiceDeps,
  params: EmbedDiaryEntryParams,
  options?: EmbedDiaryEntryOptions
): Promise<void> {
  if (!options?.skipRagEnabledCheck) {
    const ragConfig = (await deps.settingsManager.get<{ ragEnabled?: boolean }>('rag_config')) || {}
    if (!isRagMemoryEnabled({ ragEnabled: ragConfig.ragEnabled ?? true })) return
  }

  const adapter = options?.adapter ?? (await resolveEmbeddingAdapter(deps))
  if (!adapter) return

  if (!options?.skipIndexPrep) {
    await prepareMobileEmbeddingIndex(deps, adapter)
  }

  const scope = await resolveVaultScope(deps)
  const resolvedVault = params.vaultName?.trim() || (await scope.resolveActiveVaultName())
  const sourceId = buildDiaryEmbeddingSourceId(resolvedVault, params.diaryId)
  const groupId = buildDiaryEmbeddingGroupId(resolvedVault)
  await deleteDiaryEmbeddingAliases(deps.hsRepo, resolvedVault, params.diaryId)

  const d = params.date instanceof Date ? params.date : new Date(params.date)
  const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const tagPrefix = buildDiaryEmbeddingTagPrefix(params.tags)
  const prefixedText = `${tagPrefix}[${label} 日记:]\n${params.content}`
  const metadataJson = JSON.stringify({ updated_at: params.updatedAt.getTime() })
  const embedArgs = {
    text: prefixedText,
    sourceType: 'diary',
    sourceId,
    groupId,
    sourceCreatedAt: diaryDateToSourceCreatedSeconds(d) * 1000,
    metadataJson,
    requireSuccess: true as const
  }

  try {
    await adapter.embedText(embedArgs)
  } catch (error) {
    await deps.hsRepo.deleteEmbeddingsBySource('diary', sourceId)
    throw error
  }
}
