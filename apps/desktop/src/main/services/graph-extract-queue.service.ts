import i18n from 'i18next'
import { BrowserWindow } from 'electron'
import { logger } from '@baishou/shared'
import type { GraphLlmExtractionService } from '@baishou/core-desktop'

export type GraphExtractQueueStatus = 'pending' | 'running' | 'completed' | 'error'

export interface GraphExtractQueueItem {
  id: string
  filePath: string
  date?: string
  progress: number
  status: GraphExtractQueueStatus
  error?: string
}

export type GraphExtractQueueSnapshot = {
  items: GraphExtractQueueItem[]
  activeCount: number
  pendingCount: number
  runningCount: number
  completedCount: number
  errorCount: number
}

type ExtractRunner = (opts: {
  filePath: string
  signal: AbortSignal
}) => Promise<{ done: number; failed: number; errors: Array<{ filePath: string; message: string }> }>

/**
 * Main-process background queue for graph diary extraction.
 * Mirrors SummaryQueueService: leave page OK, get-state restores UI; restart loses in-flight.
 */
export class GraphExtractQueueService {
  private static instance: GraphExtractQueueService
  private queue: GraphExtractQueueItem[] = []
  private activeCount = 0
  private concurrencyLimit = 1
  private abortController: AbortController | null = null
  private runner: ExtractRunner | null = null

  private constructor() {}

  static getInstance(): GraphExtractQueueService {
    if (!GraphExtractQueueService.instance) {
      GraphExtractQueueService.instance = new GraphExtractQueueService()
    }
    return GraphExtractQueueService.instance
  }

  setRunner(runner: ExtractRunner) {
    this.runner = runner
  }

  getQueueState(): GraphExtractQueueSnapshot {
    return this.snapshot()
  }

  get isRunning(): boolean {
    return this.activeCount > 0
  }

  stop() {
    this.abortController?.abort()
    for (const item of this.queue) {
      if (item.status === 'running' || item.status === 'pending') {
        item.status = 'error'
        item.error = i18n.t('graph.extract_user_cancelled', '用户取消了抽取')
      }
    }
    this.queue = this.queue.filter((q) => q.status !== 'error')
    this.broadcastState()
  }

  /**
   * Enqueue diary paths. Skips paths already pending/running.
   * Returns how many new items were added.
   */
  enqueue(items: Array<{ filePath: string; date?: string }>): number {
    if (!this.runner) {
      throw new Error('Graph extract queue runner not configured')
    }

    let added = 0
    for (const item of items) {
      const filePath = String(item.filePath || '').trim()
      if (!filePath) continue
      const existing = this.queue.find(
        (q) => q.id === filePath && (q.status === 'pending' || q.status === 'running')
      )
      if (existing) continue
      this.queue.push({
        id: filePath,
        filePath,
        date: item.date,
        progress: 0,
        status: 'pending'
      })
      added++
    }

    if (added > 0) {
      if (!this.abortController || this.abortController.signal.aborted) {
        this.abortController = new AbortController()
      }
      this.broadcastState()
      this.scheduleNext()
    }
    return added
  }

  private snapshot(): GraphExtractQueueSnapshot {
    const items = this.queue.map((q) => ({ ...q }))
    return {
      items,
      activeCount: this.activeCount,
      pendingCount: items.filter((i) => i.status === 'pending').length,
      runningCount: items.filter((i) => i.status === 'running').length,
      completedCount: items.filter((i) => i.status === 'completed').length,
      errorCount: items.filter((i) => i.status === 'error').length
    }
  }

  private broadcastState() {
    const state = this.snapshot()
    BrowserWindow.getAllWindows().forEach((win) => {
      try {
        win.webContents.send('graph:queue-progress', state)
      } catch {
        // window may be gone
      }
    })
  }

  private scheduleNext() {
    while (this.activeCount < this.concurrencyLimit) {
      const next = this.queue.find((q) => q.status === 'pending')
      if (!next) break
      next.status = 'running'
      next.progress = 5
      this.activeCount++
      this.broadcastState()
      void this.processTask(next)
    }
  }

  private async processTask(task: GraphExtractQueueItem) {
    const signal = this.abortController?.signal
    const runner = this.runner
    if (!runner || !signal) {
      this.activeCount = Math.max(0, this.activeCount - 1)
      return
    }

    try {
      logger.info(`[GraphExtractQueue] Starting: ${task.filePath}`)
      task.status = 'running'
      task.progress = 10
      this.broadcastState()

      if (signal.aborted) {
        throw new Error(i18n.t('graph.extract_user_cancelled', '用户取消了抽取'))
      }

      const result = await runner({ filePath: task.filePath, signal })

      if (signal.aborted) {
        task.status = 'error'
        task.error = i18n.t('graph.extract_user_cancelled', '用户取消了抽取')
        this.broadcastState()
        return
      }

      if (result.failed > 0 && result.done === 0) {
        const msg = result.errors[0]?.message || i18n.t('graph.extract_failed', '整理失败')
        task.status = 'error'
        task.error = msg
        task.progress = 100
        this.broadcastState()
        logger.warn(`[GraphExtractQueue] Failed: ${task.filePath}`, { msg })
        return
      }

      task.status = 'completed'
      task.progress = 100
      this.broadcastState()
      logger.info(`[GraphExtractQueue] Completed: ${task.filePath}`)
    } catch (e: any) {
      if (signal?.aborted || e?.name === 'AbortError') {
        task.status = 'error'
        task.error = i18n.t('graph.extract_user_cancelled', '用户取消了抽取')
      } else {
        logger.error(`[GraphExtractQueue] Task failed: ${task.filePath}`, e)
        task.status = 'error'
        task.error = e?.message || String(e)
      }
      this.broadcastState()
    } finally {
      this.activeCount = Math.max(0, this.activeCount - 1)
      if (!signal?.aborted) {
        this.scheduleNext()
      }
      if (this.activeCount === 0) {
        this.abortController = null
        setTimeout(() => {
          const hasFinished = this.queue.some(
            (q) => q.status === 'completed' || q.status === 'error'
          )
          if (hasFinished && this.activeCount === 0) {
            this.queue = this.queue.filter((q) => q.status === 'pending' || q.status === 'running')
            this.broadcastState()
          }
        }, 3000)
      }
    }
  }
}

/** Helper type export for callers that build the runner from GraphLlmExtractionService. */
export type { GraphLlmExtractionService }
