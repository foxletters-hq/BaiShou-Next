import { BrowserWindow } from 'electron'
import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import { eq } from 'drizzle-orm'
import {
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
import { getDiaryManager } from '../ipc/diary.ipc'
import { getEmbeddingService, getEmbeddingConfig } from '../ipc/rag.ipc'
import { settingsManager } from '../ipc/settings.ipc'

export type ControlledDiaryBatchEmbedProgress = {
  completed: number
  total: number
  statusText?: string
}

export type ControlledDiaryBatchEmbedResult = {
  embedded: number
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

async function loadEmbeddedDiaryIndex(): Promise<{
  embeddedIds: Set<string>
  embeddedUpdatedAtMap: Map<string, number>
}> {
  const db = getAppDb()
  const existingRows = await db
    .select({
      sourceId: memoryEmbeddingsTable.sourceId,
      metadataJson: memoryEmbeddingsTable.metadataJson
    })
    .from(memoryEmbeddingsTable)
    .where(eq(memoryEmbeddingsTable.sourceType, 'diary'))

  const embeddedIds = new Set(existingRows.map((row) => row.sourceId))
  const embeddedUpdatedAtMap = new Map<string, number>()

  for (const row of existingRows) {
    if (!row.metadataJson) continue
    try {
      const meta = JSON.parse(row.metadataJson) as { updated_at?: number }
      if (typeof meta.updated_at === 'number') {
        const currentMax = embeddedUpdatedAtMap.get(row.sourceId) ?? 0
        if (meta.updated_at > currentMax) {
          embeddedUpdatedAtMap.set(row.sourceId, meta.updated_at)
        }
      }
    } catch {
      /* ignore malformed metadata */
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
    return { embedded: 0, total: 0, skipped: true, skipReason: 'rag-disabled' }
  }

  const embeddingService = getEmbeddingService()
  if (!embeddingService.isConfigured) {
    return { embedded: 0, total: 0, skipped: true, skipReason: 'embedding-not-configured' }
  }

  if (embeddingService.isMigrationRunning()) {
    return { embedded: 0, total: 0, skipped: true, skipReason: 'migration-running' }
  }

  const diaries = await getDiaryManager().listAll({ limit: 10000 })
  const { embeddedIds, embeddedUpdatedAtMap } = await loadEmbeddedDiaryIndex()
  const diariesToEmbed = sortDiariesByDateAsc(
    filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)
  )
  const total = diariesToEmbed.length
  const groupId = options?.groupId ?? 'diary_batch'

  if (total === 0) {
    if (hasRagDiaryEmbedFailure(ragConfig)) {
      await settingsManager.set('rag_config', clearRagDiaryEmbedFailure(ragConfig))
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('diary:sync-event', { type: 'embed-failure-cleared' })
      }
    }
    return { embedded: 0, total: 0, skipped: true, skipReason: 'nothing-to-embed' }
  }

  const batchRagConfig =
    (await settingsManager.get<{ batchEmbedConcurrency?: number }>('rag_config')) || {}
  const batchConcurrency = resolveBatchEmbedConcurrency(batchRagConfig.batchEmbedConcurrency)

  await embeddingService.prepareEmbeddingIndex()

  let completed = 0
  let embedded = 0

  await limitExecute(diariesToEmbed, batchConcurrency, async (meta) => {
    const dateLabel = new Date(meta.date).toLocaleDateString()
    reportProgress(options, { completed, total, statusText: `处理日记: ${dateLabel}` }, total)

    const diary = await getDiaryManager().findById(meta.id)
    if (!diary?.id || !diary.content?.trim()) {
      completed++
      return
    }

    const d = diary.date
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const tagPrefix = meta.tags.length > 0 ? `[标签: ${meta.tags.join(', ')}] ` : ''
    const sourceCreatedAt = diaryDateToSourceCreatedSeconds(d) * 1000

    await embeddingService.reEmbedText({
      text: diary.content,
      sourceType: 'diary',
      sourceId: diary.id.toString(),
      groupId,
      chunkPrefix: `${tagPrefix}[${label} 日记:]\n`,
      metadataJson: JSON.stringify({ updated_at: diary.updatedAt?.getTime() ?? Date.now() }),
      sourceCreatedAt,
      skipIndexPrep: true
    })

    embedded++
    completed++
    reportProgress(options, { completed, total, statusText: `处理日记: ${dateLabel}` }, total)
  })

  if (options?.broadcastProgress) {
    broadcastRagProgress({
      isRunning: false,
      progress: total,
      total,
      type: 'idle'
    })
  }

  const latestRagConfig =
    (await settingsManager.get<RagConfig>('rag_config')) || ({} as RagConfig)
  if (hasRagDiaryEmbedFailure(latestRagConfig)) {
    await settingsManager.set('rag_config', clearRagDiaryEmbedFailure(latestRagConfig))
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('diary:sync-event', { type: 'embed-failure-cleared' })
    }
  }

  logger.info('[ControlledDiaryBatchEmbed] finished', { embedded, total, groupId })
  return { embedded, total, skipped: false }
}

async function runPostSyncDiaryBatchEmbedLoop(): Promise<ControlledDiaryBatchEmbedResult> {
  let lastResult: ControlledDiaryBatchEmbedResult = {
    embedded: 0,
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
        total: 0,
        skipped: true,
        skipReason: 'failed'
      } satisfies ControlledDiaryBatchEmbedResult
    })
    .finally(() => {
      inFlight = null
    })
}
