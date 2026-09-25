import { ipcMain } from 'electron'
import * as nodePath from 'node:path'
import {
  clearLifeGraphData,
  estimateExtractionCost,
  type GraphExtractDraft
} from '@baishou/core-desktop'
import {
  GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR,
  resolveGraphExtractConcurrency
} from '@baishou/shared'
import { fileSystem, pathService } from './vault.ipc'
import { ensureRawDataRuntime, getDerivedFreshness } from '../services/raw-data-source.runtime'
import { GraphExtractQueueService } from '../services/graph-extract-queue.service'
import {
  buildExtractionService,
  enqueueGraphExtract,
  resolveExtractSelfName
} from './graph-extract.runtime'
import { requireGraphRepo, requireVaultId, requireVaultName } from './graph-ipc.context'

export function registerGraphExtractIpc(): void {
  ipcMain.handle('graph:list-pending-reextract', async () => {
    ensureRawDataRuntime()
    return getDerivedFreshness().listPendingReextract()
  })

  ipcMain.handle('graph:list-pending-index', async () => {
    const { graphManager } = ensureRawDataRuntime()
    return graphManager.listPendingIndex()
  })

  ipcMain.handle('graph:estimate-extraction', async () => {
    ensureRawDataRuntime()
    const pending = await getDerivedFreshness().listPendingReextract()
    const vault = await pathService.getActiveVaultPath()
    const charCounts: number[] = []
    if (vault) {
      for (const item of pending) {
        try {
          const full = nodePath.join(vault, item.filePath.replace(/^[/\\]+/, ''))
          const text = await fileSystem.readFile(full, 'utf8')
          charCounts.push(typeof text === 'string' ? text.length : 0)
        } catch {
          charCounts.push(0)
        }
      }
    }
    return estimateExtractionCost(pending.length, { charCounts })
  })

  // Background extract queue (leave Graph page OK; restart loses in-flight).
  const extractQueue = GraphExtractQueueService.getInstance()
  extractQueue.setFlushDrafts(async (items, signal, onPhase) => {
    const service = await buildExtractionService()
    return service.commitDrafts(
      items.map((item) => item.draft as GraphExtractDraft),
      signal,
      onPhase
    )
  })
  extractQueue.setRunner(async ({ filePath, signal, onProgress }) => {
    const vaultName = requireVaultName()
    const selfName = await resolveExtractSelfName()
    const service = await buildExtractionService()
    const draft = await service.extractDraft({
      vaultId: requireVaultId(),
      vaultName,
      selfName,
      filePath,
      signal,
      onProgress
    })
    return { done: 1, failed: 0, errors: [], draft }
  })

  ipcMain.handle('graph:get-queue-state', async () => extractQueue.getQueueState())

  ipcMain.handle('graph:stop-extract', async () => {
    extractQueue.stop()
    return { ok: true }
  })

  ipcMain.handle('graph:cancel-queue-item', async (_e, opts: { filePath: string }) => {
    return { ok: extractQueue.cancelItem(opts?.filePath) }
  })

  // Alias for older clients
  ipcMain.handle('graph:extract-cancel', async () => {
    extractQueue.stop()
    return { ok: true }
  })

  ipcMain.handle('graph:set-extract-concurrency', async (_e, opts?: { concurrency?: number }) => {
    const concurrency = resolveGraphExtractConcurrency(opts?.concurrency)
    extractQueue.setConcurrency(concurrency)
    return { concurrency }
  })

  ipcMain.handle(
    'graph:queue-extract',
    async (_e, opts?: { filePaths?: string[]; concurrency?: number }) => {
      return enqueueGraphExtract(extractQueue, opts)
    }
  )

  /**
   * Backward-compatible: enqueue and return immediately (no longer blocks until batch done).
   * Prefer graph:queue-extract + graph:queue-progress.
   */
  ipcMain.handle(
    'graph:extract',
    async (_e, opts?: { filePaths?: string[]; concurrency?: number }) => {
      const result = await enqueueGraphExtract(extractQueue, opts)
      return {
        done: 0,
        failed: result.skippedNotEmbedded.length,
        queued: result.queued,
        skippedNotEmbedded: result.skippedNotEmbedded,
        blockedPendingEmbed: result.blockedPendingEmbed,
        errors: result.skippedNotEmbedded.map((filePath) => ({
          filePath,
          message: GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR
        }))
      }
    }
  )

  ipcMain.handle('graph:clear-life-graph', async () => {
    const { graphManager, freshness } = ensureRawDataRuntime()
    const result = await clearLifeGraphData({
      vaultId: requireVaultId(),
      graphRepo: requireGraphRepo(),
      graphManager,
      freshness,
      stopExtract: () => extractQueue.stop()
    })
    const { notifyPendingEmbedCountsChanged } =
      await import('../services/pending-embed-counts.service')
    notifyPendingEmbedCountsChanged()
    return { ok: true, ...result }
  })
}
