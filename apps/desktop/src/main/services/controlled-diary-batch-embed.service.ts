import { BrowserWindow } from 'electron'
import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import { eq, sql, and } from 'drizzle-orm'
import {
  buildDiaryEmbeddingGroupId,
  buildDiaryEmbeddingSourceId,
  clearRagDiaryEmbedFailure,
  diaryDateToSourceCreatedSeconds,
  filterUnindexedDiaries,
  hasRagDiaryEmbedFailure,
  isRagMemoryEnabled,
  limitExecute,
  logger,
  resolveBatchEmbedConcurrency,
  sortDiariesByDateAsc,
  type RagConfig
} from '@baishou/shared'

import { getAppDb } from '../db'
import { getEmbeddingService, getEmbeddingConfig } from '../ipc/rag.ipc'
import { settingsManager } from '../ipc/settings.ipc'
import { vaultService } from '../ipc/vault.ipc'
import { getDiaryManagerForVault } from './diary-vault.factory'
import {
  deleteDiaryEmbeddingAliases,
  purgeAllLegacyDiaryEmbeddings,
  purgeLegacyDiaryEmbeddingsForVault
} from './diary-embedding.util'

export type ControlledDiaryBatchEmbedProgress = {
  completed: number
  total: number
  statusText?: string
}

export type ControlledDiaryBatchEmbedResult = {
  embedded: number
  /** 无正文、无法读取而跳过的日记篇数 */
  loadSkipped: number
  /** 嵌入 API/写入失败而跳过的日记篇数 */
  failed: number
  total: number
  skipped: boolean
  skipReason?: string
}

type RunControlledDiaryBatchEmbedOptions = {
  onProgress?: (progress: ControlledDiaryBatchEmbedProgress) => void
  broadcastProgress?: boolean
  groupId?: string
}

let inFlight: Promise<ControlledDiaryBatchEmbedResult> | null = null
let rerunRequested = false

async function loadEmbeddedDiaryIndex(vaultName: string): Promise<{
  embeddedIds: Set<string>
  embeddedUpdatedAtMap: Map<string, number>
}> {
  const db = getAppDb()
  const groupId = buildDiaryEmbeddingGroupId(vaultName)
  const existingRows = await db
    .select({
      sourceId: memoryEmbeddingsTable.sourceId,
      maxUpdatedAt: sql<number>`MAX(CAST(json_extract(${memoryEmbeddingsTable.metadataJson}, '$.updated_at') AS INTEGER))`
    })
    .from(memoryEmbeddingsTable)
    .where(
      and(eq(memoryEmbeddingsTable.sourceType, 'diary'), eq(memoryEmbeddingsTable.groupId, groupId))
    )
    .groupBy(memoryEmbeddingsTable.sourceId)

  const embeddedIds = new Set(existingRows.map((row) => row.sourceId))
  const embeddedUpdatedAtMap = new Map<string, number>()

  for (const row of existingRows) {
    if (typeof row.maxUpdatedAt === 'number' && row.maxUpdatedAt > 0) {
      embeddedUpdatedAtMap.set(row.sourceId, row.maxUpdatedAt)
    }
  }

  return { embeddedIds, embeddedUpdatedAtMap }
}

function broadcastRagProgress(payload: Record<string, unknown>): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('agent:rag-progress', payload)
  }
}

function reportProgress(
  options: RunControlledDiaryBatchEmbedOptions | undefined,
  progress: ControlledDiaryBatchEmbedProgress,
  total: number
): void {
  options?.onProgress?.(progress)
  if (!options?.broadcastProgress) return
  broadcastRagProgress({
    isRunning: true,
    type: 'batchEmbed',
    progress: progress.completed,
    total,
    statusText: progress.statusText
  })
}

export async function runControlledDiaryBatchEmbed(
  options?: RunControlledDiaryBatchEmbedOptions
): Promise<ControlledDiaryBatchEmbedResult> {
  const config = getEmbeddingConfig()
  await config.load()

  const ragConfig = (await settingsManager.get<RagConfig>('rag_config')) || ({} as RagConfig)
  if (!isRagMemoryEnabled(ragConfig)) {
    return {
      embedded: 0,
      loadSkipped: 0,
      failed: 0,
      total: 0,
      skipped: true,
      skipReason: 'rag-disabled'
    }
  }

  const embeddingService = getEmbeddingService()
  if (!embeddingService.isConfigured) {
    return {
      embedded: 0,
      loadSkipped: 0,
      failed: 0,
      total: 0,
      skipped: true,
      skipReason: 'embedding-not-configured'
    }
  }

  if (embeddingService.isMigrationRunning()) {
    return {
      embedded: 0,
      loadSkipped: 0,
      failed: 0,
      total: 0,
      skipped: true,
      skipReason: 'migration-running'
    }
  }

  const batchRagConfig =
    (await settingsManager.get<{ batchEmbedConcurrency?: number }>('rag_config')) || {}
  const batchConcurrency = resolveBatchEmbedConcurrency(batchRagConfig.batchEmbedConcurrency)

  await embeddingService.prepareEmbeddingIndex()

  const purgedLegacy = await purgeAllLegacyDiaryEmbeddings()
  if (purgedLegacy > 0) {
    logger.info('[ControlledDiaryBatchEmbed] purged global legacy diary vectors', {
      count: purgedLegacy
    })
  }

  const vaults = vaultService.getAllVaults()
  type DiaryMetaList = Awaited<
    ReturnType<Awaited<ReturnType<typeof getDiaryManagerForVault>>['listAll']>
  >
  const vaultPlans: Array<{
    vaultName: string
    diariesToEmbed: DiaryMetaList
    allDiaryIds: Array<number | string>
  }> = []
  let globalTotal = 0

  for (const vault of vaults) {
    const diaryManager = await getDiaryManagerForVault(vault.name)
    const diaries = await diaryManager.listAll({ limit: 10000 })
    const { embeddedIds, embeddedUpdatedAtMap } = await loadEmbeddedDiaryIndex(vault.name)
    const resolveSourceId = (meta: { id: unknown }) =>
      buildDiaryEmbeddingSourceId(vault.name, meta.id as number | string)
    const diariesToEmbed = sortDiariesByDateAsc(
      filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap, { resolveSourceId })
    )
    if (diariesToEmbed.length === 0) continue
    vaultPlans.push({
      vaultName: vault.name,
      diariesToEmbed,
      allDiaryIds: diaries.map((d) => d.id)
    })
    globalTotal += diariesToEmbed.length
  }

  if (globalTotal === 0) {
    if (hasRagDiaryEmbedFailure(ragConfig)) {
      await settingsManager.set('rag_config', clearRagDiaryEmbedFailure(ragConfig))
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('diary:sync-event', { type: 'embed-failure-cleared' })
      }
    }
    return {
      embedded: 0,
      loadSkipped: 0,
      failed: 0,
      total: 0,
      skipped: true,
      skipReason: 'nothing-to-embed'
    }
  }

  let globalCompleted = 0
  let embedded = 0
  let loadSkipped = 0
  let failed = 0

  for (const plan of vaultPlans) {
    const vaultResult = await embedVaultDiaries(plan, {
      embeddingService,
      batchConcurrency,
      globalTotal,
      getGlobalCompleted: () => globalCompleted,
      setGlobalCompleted: (n) => {
        globalCompleted = n
      },
      getGlobalEmbedded: () => embedded,
      getGlobalFailed: () => failed,
      options
    })
    embedded += vaultResult.embedded
    loadSkipped += vaultResult.loadSkipped
    failed += vaultResult.failed
  }

  if (options?.broadcastProgress) {
    broadcastRagProgress({
      isRunning: false,
      progress: globalTotal,
      total: globalTotal,
      type: 'idle'
    })
  }

  const latestRagConfig = (await settingsManager.get<RagConfig>('rag_config')) || ({} as RagConfig)
  if (hasRagDiaryEmbedFailure(latestRagConfig)) {
    await settingsManager.set('rag_config', clearRagDiaryEmbedFailure(latestRagConfig))
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('diary:sync-event', { type: 'embed-failure-cleared' })
    }
  }

  logger.info('[ControlledDiaryBatchEmbed] finished', {
    embedded,
    loadSkipped,
    failed,
    total: globalTotal,
    vaultCount: vaultPlans.length
  })
  return { embedded, loadSkipped, failed, total: globalTotal, skipped: false }
}

type VaultEmbedPlan = {
  vaultName: string
  diariesToEmbed: Awaited<
    ReturnType<Awaited<ReturnType<typeof getDiaryManagerForVault>>['listAll']>
  >
  allDiaryIds: Array<number | string>
}

type EmbedVaultDiariesContext = {
  embeddingService: ReturnType<typeof getEmbeddingService>
  batchConcurrency: number
  globalTotal: number
  getGlobalCompleted: () => number
  setGlobalCompleted: (value: number) => void
  getGlobalEmbedded: () => number
  getGlobalFailed: () => number
  options?: RunControlledDiaryBatchEmbedOptions
}

async function embedVaultDiaries(
  plan: VaultEmbedPlan,
  ctx: EmbedVaultDiariesContext
): Promise<{
  embedded: number
  loadSkipped: number
  failed: number
}> {
  const { vaultName, diariesToEmbed } = plan
  const diaryManager = await getDiaryManagerForVault(vaultName)

  await purgeLegacyDiaryEmbeddingsForVault(vaultName, plan.allDiaryIds)

  const groupId = buildDiaryEmbeddingGroupId(vaultName)
  let embedded = 0
  let loadSkipped = 0
  let failed = 0

  await limitExecute(diariesToEmbed, ctx.batchConcurrency, async (meta) => {
    const dateLabel = new Date(meta.date).toLocaleDateString()
    const completed = ctx.getGlobalCompleted()
    ctx.options &&
      reportProgress(
        ctx.options,
        {
          completed,
          total: ctx.globalTotal,
          statusText: `[${vaultName}] 已嵌入 ${ctx.getGlobalEmbedded() + embedded}/${ctx.globalTotal}${ctx.getGlobalFailed() + failed > 0 ? `（失败 ${ctx.getGlobalFailed() + failed}）` : ''}（${dateLabel}）`
        },
        ctx.globalTotal
      )

    const diary = (await diaryManager.findByIdsForEmbedding([meta.id])).get(meta.id)
    if (!diary?.id || !diary.content?.trim()) {
      loadSkipped++
      ctx.setGlobalCompleted(ctx.getGlobalCompleted() + 1)
      logger.warn('[ControlledDiaryBatchEmbed] 跳过无正文日记', {
        vaultName,
        diaryId: meta.id,
        date: dateLabel
      })
      return
    }

    const d = diary.date
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const tagPrefix = meta.tags.length > 0 ? `[标签: ${meta.tags.join(', ')}] ` : ''
    const sourceCreatedAt = diaryDateToSourceCreatedSeconds(d) * 1000
    const sourceId = buildDiaryEmbeddingSourceId(vaultName, diary.id)

    try {
      await deleteDiaryEmbeddingAliases(vaultName, diary.id)
      await ctx.embeddingService.reEmbedText({
        text: diary.content,
        sourceType: 'diary',
        sourceId,
        groupId,
        chunkPrefix: `${tagPrefix}[${label} 日记:]\n`,
        metadataJson: JSON.stringify({ updated_at: diary.updatedAt?.getTime() ?? Date.now() }),
        sourceCreatedAt,
        skipIndexPrep: true
      })
      embedded++
    } catch (error) {
      failed++
      logger.warn('[ControlledDiaryBatchEmbed] 单篇嵌入失败', {
        vaultName,
        diaryId: meta.id,
        date: dateLabel,
        error
      })
    } finally {
      ctx.setGlobalCompleted(ctx.getGlobalCompleted() + 1)
      ctx.options &&
        reportProgress(
          ctx.options,
          {
            completed: ctx.getGlobalCompleted(),
            total: ctx.globalTotal,
            statusText: `[${vaultName}] 已嵌入 ${ctx.getGlobalEmbedded() + embedded}/${ctx.globalTotal}${ctx.getGlobalFailed() + failed > 0 ? `（失败 ${ctx.getGlobalFailed() + failed}）` : ''}（${dateLabel}）`
          },
          ctx.globalTotal
        )
    }
  })

  return { embedded, loadSkipped, failed }
}

async function runPostSyncDiaryBatchEmbedLoop(): Promise<ControlledDiaryBatchEmbedResult> {
  let lastResult: ControlledDiaryBatchEmbedResult = {
    embedded: 0,
    loadSkipped: 0,
    failed: 0,
    total: 0,
    skipped: true,
    skipReason: 'not-started'
  }

  do {
    rerunRequested = false
    lastResult = await runControlledDiaryBatchEmbed({
      broadcastProgress: true,
      groupId: 'diary_post_sync'
    })
  } while (rerunRequested)

  return lastResult
}

/** 同步完成后在后台触发受控批量嵌入（单飞 + 可合并重复调度） */
export function schedulePostSyncDiaryBatchEmbed(): void {
  if (inFlight) {
    rerunRequested = true
    return
  }

  inFlight = runPostSyncDiaryBatchEmbedLoop()
    .catch((error: unknown) => {
      logger.warn('[ControlledDiaryBatchEmbed] post-sync batch embed failed', { error })
      broadcastRagProgress({
        isRunning: false,
        type: 'idle',
        progress: 0,
        total: 0,
        error: error instanceof Error ? error.message : String(error)
      })
      return {
        embedded: 0,
        loadSkipped: 0,
        failed: 0,
        total: 0,
        skipped: true,
        skipReason: 'failed'
      } satisfies ControlledDiaryBatchEmbedResult
    })
    .finally(() => {
      inFlight = null
    })
}
