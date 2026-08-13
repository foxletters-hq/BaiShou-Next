import i18n from 'i18next'
import { GRAPH_SELF_NAME_REQUIRED_ERROR, logger } from '@baishou/shared'
import type { AppDatabase, ShadowIndexRepository } from '@baishou/database'
import type { IFileSystem, IStoragePathService, SettingsManagerService } from '@baishou/core-mobile'
import { mobileExtractDiaries, mobileListPendingReextract } from './mobile-graph.service'

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

export type MobileGraphExtractContext = {
  vaultId: string
  vaultName: string
  drizzleDb: AppDatabase
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
  settingsManager: SettingsManagerService
}

type Listener = (state: GraphExtractQueueSnapshot) => void

/**
 * Module-level queue so extract keeps running when GraphScreen unmounts
 * (unlike summary hook which dies with the screen).
 */
class MobileGraphExtractQueue {
  private queue: GraphExtractQueueItem[] = []
  private activeCount = 0
  private abortController: AbortController | null = null
  private listeners = new Set<Listener>()
  private context: MobileGraphExtractContext | null = null
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  getQueueState(): GraphExtractQueueSnapshot {
    return this.snapshot()
  }

  get isRunning(): boolean {
    return this.activeCount > 0
  }

  setContext(ctx: MobileGraphExtractContext) {
    this.context = ctx
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
    this.broadcast()
  }

  async enqueue(
    opts?: { filePaths?: string[] },
    ctx?: MobileGraphExtractContext
  ): Promise<{ queued: number; totalPending: number }> {
    if (ctx) this.context = ctx
    if (!this.context) {
      throw new Error(i18n.t('graph.extract_queue_no_context', '图谱抽取队列未就绪'))
    }

    const pending = await mobileListPendingReextract({
      vaultName: this.context.vaultName,
      shadowRepo: this.context.shadowRepo,
      pathService: this.context.pathService,
      fileSystem: this.context.fileSystem
    })
    const wanted = opts?.filePaths?.length ? opts.filePaths : pending.map((p) => p.filePath)
    const byPath = new Map(pending.map((p) => [p.filePath, p]))

    let added = 0
    for (const filePath of wanted) {
      const path = String(filePath || '').trim()
      if (!path) continue
      const existing = this.queue.find(
        (q) => q.id === path && (q.status === 'pending' || q.status === 'running')
      )
      if (existing) continue
      const hit = byPath.get(path)
      this.queue.push({
        id: path,
        filePath: path,
        date: hit?.date,
        progress: 0,
        status: 'pending'
      })
      added++
    }

    if (added > 0) {
      if (!this.abortController || this.abortController.signal.aborted) {
        this.abortController = new AbortController()
      }
      this.broadcast()
      this.scheduleNext()
    }
    return { queued: added, totalPending: wanted.length }
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

  private broadcast() {
    const state = this.snapshot()
    for (const listener of this.listeners) {
      try {
        listener(state)
      } catch {
        // ignore listener errors
      }
    }
  }

  private scheduleNext() {
    while (this.activeCount < 1) {
      const next = this.queue.find((q) => q.status === 'pending')
      if (!next) break
      next.status = 'running'
      next.progress = 10
      this.activeCount++
      this.broadcast()
      void this.processTask(next)
    }
  }

  private async processTask(task: GraphExtractQueueItem) {
    const signal = this.abortController?.signal
    const ctx = this.context
    if (!signal || !ctx) {
      this.activeCount = Math.max(0, this.activeCount - 1)
      return
    }

    try {
      logger.info(`[MobileGraphExtractQueue] Starting: ${task.filePath}`)
      task.status = 'running'
      task.progress = 10
      this.broadcast()

      if (signal.aborted) {
        throw new Error(i18n.t('graph.extract_user_cancelled', '用户取消了抽取'))
      }

      const result = await mobileExtractDiaries({
        ...ctx,
        filePaths: [task.filePath],
        signal
      })

      if (signal.aborted) {
        task.status = 'error'
        task.error = i18n.t('graph.extract_user_cancelled', '用户取消了抽取')
        this.broadcast()
        return
      }

      if (result.failed > 0 && result.done === 0) {
        task.status = 'error'
        task.error =
          result.errors[0]?.message || i18n.t('graph.extract_failed', '整理失败')
        task.progress = 100
        this.broadcast()
        return
      }

      task.status = 'completed'
      task.progress = 100
      this.broadcast()
      logger.info(`[MobileGraphExtractQueue] Completed: ${task.filePath}`)
    } catch (e: any) {
      if (signal.aborted || e?.name === 'AbortError') {
        task.status = 'error'
        task.error = i18n.t('graph.extract_user_cancelled', '用户取消了抽取')
      } else if (e?.message === GRAPH_SELF_NAME_REQUIRED_ERROR) {
        task.status = 'error'
        task.error = GRAPH_SELF_NAME_REQUIRED_ERROR
      } else {
        logger.error(`[MobileGraphExtractQueue] Failed: ${task.filePath}`, e)
        task.status = 'error'
        task.error = e?.message || String(e)
      }
      this.broadcast()
    } finally {
      this.activeCount = Math.max(0, this.activeCount - 1)
      if (!signal.aborted) {
        this.scheduleNext()
      }
      if (this.activeCount === 0) {
        this.abortController = null
        if (this.cleanupTimer) clearTimeout(this.cleanupTimer)
        this.cleanupTimer = setTimeout(() => {
          if (this.activeCount === 0) {
            this.queue = this.queue.filter((q) => q.status === 'pending' || q.status === 'running')
            this.broadcast()
          }
        }, 3000)
      }
    }
  }
}

export const mobileGraphExtractQueue = new MobileGraphExtractQueue()
