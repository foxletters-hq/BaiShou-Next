import { BrowserWindow } from 'electron'
import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import { eq, like, or, sql, and } from 'drizzle-orm'
import {
  buildDiaryEmbeddingSourceId,
  clearRagDiaryEmbedFailure,
  filterUnindexedDiaries,
  formatAiApiCallError,
  hasRagDiaryEmbedFailure,
  isRagMemoryEnabled,
  limitExecute,
  i18n,
  logger,
  markRagDiaryEmbedFailure,
  resolveBatchEmbedConcurrency,
  sortDiariesByDateAsc,
  DIARY_EMBED_GROUP_ID,
  type RagConfig
} from '@baishou/shared'
import {
  assertBatchEmbedCanContinue,
  checkpointBatchEmbed,
  isBatchEmbedAbortRequested,
  throwIfBatchEmbedAborted
} from './batch-embed-control.service'
import { buildDesktopDiaryReEmbedArgs } from './diary-embed-text.util'

import { getAppDb } from '../db'
import { DesktopEmbeddingStorage } from '../ipc/rag.storage'
import { getEmbeddingService, getEmbeddingConfig } from '../ipc/rag.ipc'
import { settingsManager } from '../ipc/settings.ipc'
import { vaultService } from '../ipc/vault.ipc'
import { getDiaryManagerForVault } from './diary-vault.factory'
import { purgeLegacyDiaryEmbeddingsForVault } from './diary-embedding.util'
import { probeEmbeddingApi } from './embed-api-probe.util'

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
  lastError?: string
}

type RunControlledDiaryBatchEmbedOptions = {
  onProgress?: (progress: ControlledDiaryBatchEmbedProgress) => void
  broadcastProgress?: boolean
  groupId?: string
}

async function loadEmbeddedDiaryIndex(vaultId: string): Promise<{
  embeddedIds: Set<string>
  embeddedUpdatedAtMap: Map<string, number>
  embeddedContentHashMap: Map<string, string>
}> {
  const storage = new DesktopEmbeddingStorage()
  await storage.reconcileEmbedLedger({ vaultId, sourceType: 'diary' })

  const db = getAppDb()
  const existingRows = await db
    .select({
      sourceId: memoryEmbeddingsTable.sourceId,
      maxUpdatedAt: sql<number>`MAX(CAST(json_extract(${memoryEmbeddingsTable.metadataJson}, '$.updated_at') AS INTEGER))`,
      contentHash: sql<string>`MAX(COALESCE(json_extract(${memoryEmbeddingsTable.metadataJson}, '$.content_hash'), ''))`
    })
    .from(memoryEmbeddingsTable)
    .where(
      and(
        eq(memoryEmbeddingsTable.sourceType, 'diary'),
        or(
          eq(memoryEmbeddingsTable.groupId, DIARY_EMBED_GROUP_ID),
          like(memoryEmbeddingsTable.groupId, 'diary:%')
        ),
        eq(memoryEmbeddingsTable.vaultId, vaultId)
      )
    )
    .groupBy(memoryEmbeddingsTable.sourceId)

  const embeddedIds = new Set(existingRows.map((row) => row.sourceId))
  const embeddedUpdatedAtMap = new Map<string, number>()
  const embeddedContentHashMap = new Map<string, string>()

  for (const row of existingRows) {
    if (typeof row.maxUpdatedAt === 'number' && row.maxUpdatedAt > 0) {
      embeddedUpdatedAtMap.set(row.sourceId, row.maxUpdatedAt)
    }
    if (row.sourceId && typeof row.contentHash === 'string' && row.contentHash.trim()) {
      embeddedContentHashMap.set(row.sourceId, row.contentHash.trim())
    }
  }

  return { embeddedIds, embeddedUpdatedAtMap, embeddedContentHashMap }
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
  await assertBatchEmbedCanContinue()

  const activeVault = vaultService.getActiveVault()
  const vaults = activeVault ? [activeVault] : []
  type DiaryDetectionList = Awaited<
    ReturnType<Awaited<ReturnType<typeof getDiaryManagerForVault>>['listForEmbedDetection']>
  >
  const vaultPlans: Array<{
    vaultId: string
    vaultName: string
    diariesToEmbed: DiaryDetectionList
    allDiaryIds: Array<number | string>
  }> = []
  let globalTotal = 0

  for (const vault of vaults) {
    await assertBatchEmbedCanContinue()
    const diaryManager = await getDiaryManagerForVault(vault.name)
    const diaries = await diaryManager.listForEmbedDetection()
    const { embeddedIds, embeddedUpdatedAtMap, embeddedContentHashMap } =
      await loadEmbeddedDiaryIndex(vault.id)
    const resolveSourceId = (meta: { id: unknown }) =>
      buildDiaryEmbeddingSourceId(vault.id, meta.id as number | string)
    const diariesToEmbed = sortDiariesByDateAsc(
      filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap, {
        resolveSourceId,
        embeddedContentHashMap
      })
    )
    if (diariesToEmbed.length === 0) continue
    vaultPlans.push({
      vaultId: vault.id,
      vaultName: vault.name,
      diariesToEmbed,
      allDiaryIds: diaries.map((d) => d.id)
    })
    globalTotal += diariesToEmbed.length
  }

  if (globalTotal === 0) {
    throwIfBatchEmbedAborted()
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

  reportProgress(
    options,
    {
      completed: 0,
      total: globalTotal,
      statusText: i18n.t('settings.rag_indexing_diary', '正在嵌入日记…')
    },
    globalTotal
  )

  const probe = await probeEmbeddingApi((text) => embeddingService.embedQuery(text))
  if (!probe.ok) {
    await settingsManager.set('rag_config', markRagDiaryEmbedFailure(ragConfig, probe.message))
    return {
      embedded: 0,
      loadSkipped: 0,
      failed: globalTotal,
      total: globalTotal,
      skipped: false,
      lastError: probe.message
    }
  }

  let globalCompleted = 0
  let embedded = 0
  let loadSkipped = 0
  let failed = 0
  let lastError: string | undefined
  let stopAfterApiFailures = false

  for (const plan of vaultPlans) {
    await assertBatchEmbedCanContinue()
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
      shouldStop: () => stopAfterApiFailures,
      options
    })
    embedded += vaultResult.embedded
    loadSkipped += vaultResult.loadSkipped
    failed += vaultResult.failed
    if (vaultResult.lastError) lastError = vaultResult.lastError
    if (vaultResult.failed > 0) {
      stopAfterApiFailures = true
      break
    }
  }
  throwIfBatchEmbedAborted()

  if (options?.broadcastProgress) {
    broadcastRagProgress({
      isRunning: false,
      progress: globalTotal,
      total: globalTotal,
      type: 'idle'
    })
  }

  const latestRagConfig = (await settingsManager.get<RagConfig>('rag_config')) || ({} as RagConfig)
  if (failed > 0 && embedded === 0) {
    await settingsManager.set(
      'rag_config',
      markRagDiaryEmbedFailure(
        latestRagConfig,
        lastError ||
          i18n.t('settings.rag_diary_embed_no_vectors', '嵌入接口不可用，没有写入任何日记向量')
      )
    )
  } else if (failed === 0 && hasRagDiaryEmbedFailure(latestRagConfig)) {
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
  return { embedded, loadSkipped, failed, total: globalTotal, skipped: false, lastError }
}

type VaultEmbedPlan = {
  vaultId: string
  vaultName: string
  diariesToEmbed: Awaited<
    ReturnType<Awaited<ReturnType<typeof getDiaryManagerForVault>>['listForEmbedDetection']>
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
  shouldStop?: () => boolean
  options?: RunControlledDiaryBatchEmbedOptions
}

async function embedVaultDiaries(
  plan: VaultEmbedPlan,
  ctx: EmbedVaultDiariesContext
): Promise<{
  embedded: number
  loadSkipped: number
  failed: number
  lastError?: string
}> {
  const { vaultId, vaultName, diariesToEmbed } = plan
  const diaryManager = await getDiaryManagerForVault(vaultName)

  await purgeLegacyDiaryEmbeddingsForVault(vaultId, plan.allDiaryIds)

  let embedded = 0
  let loadSkipped = 0
  let failed = 0
  let lastError: string | undefined
  let abortAfterRetryExhausted = false
  // 限制同时进入文件读取/分词/SQLite 写入的日记篇数，与全局嵌入槽位上限（12）匹配，兼顾高吞吐与低排队延迟。
  const effectiveConcurrency = Math.max(1, Math.min(ctx.batchConcurrency, 10))
  const diaryById = await diaryManager.findByIdsForEmbedding(diariesToEmbed.map((meta) => meta.id))

  await limitExecute(
    diariesToEmbed,
    effectiveConcurrency,
    async (meta) => {
      if (abortAfterRetryExhausted) return
      if ((await checkpointBatchEmbed()) === 'aborted') return
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

      let diary = diaryById.get(meta.id)
      diaryById.delete(meta.id)
      if (!diary) {
        diary = (await diaryManager.findByIdsForEmbedding([meta.id])).get(meta.id)
      }
      if (!diary?.id) {
        loadSkipped++
        ctx.setGlobalCompleted(ctx.getGlobalCompleted() + 1)
        logger.warn('[ControlledDiaryBatchEmbed] 跳过无法读取的日记', {
          vaultName,
          diaryId: meta.id,
          date: dateLabel
        })
        return
      }

      let itemFailed = false
      try {
        await ctx.embeddingService.reEmbedText(
          buildDesktopDiaryReEmbedArgs({
            content: diary.content ?? '',
            date: diary.date,
            vaultId,
            diaryId: diary.id,
            updatedAt: diary.updatedAt ?? Date.now(),
            skipIndexPrep: true
          })
        )
        if (!diary.content?.trim()) {
          loadSkipped++
          return
        }
        embedded++
      } catch (error) {
        itemFailed = true
        failed++
        abortAfterRetryExhausted = true
        lastError = formatAiApiCallError(error)
        logger.warn('[ControlledDiaryBatchEmbed] 单篇嵌入重试 3 次后仍失败，中止剩余队列', {
          vaultName,
          diaryId: meta.id,
          date: dateLabel,
          error
        })
      } finally {
        if (!itemFailed) {
          ctx.setGlobalCompleted(ctx.getGlobalCompleted() + 1)
        }
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
    },
    {
      shouldStop: () =>
        isBatchEmbedAbortRequested() || Boolean(ctx.shouldStop?.()) || abortAfterRetryExhausted
    }
  )

  return { embedded, loadSkipped, failed, lastError }
}

/** 同步后不再自动批量嵌入。保留导出以免旧 import 断裂。 */
export function schedulePostSyncDiaryBatchEmbed(): void {
  // no-op
}
