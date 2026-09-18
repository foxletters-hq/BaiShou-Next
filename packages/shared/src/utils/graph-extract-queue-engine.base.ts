import { normalizeGraphFilePath } from './graph-identity.util'
import { isDiaryGraphFollowCancelled } from './diary-graph-follow-after-embed.util'
import {
  GRAPH_EXTRACT_ALIGN_POOL_SIZE,
  GRAPH_EXTRACT_CONCURRENCY_DEFAULT,
  graphExtractOverallProgress,
  isGraphExtractBusyStatus,
  resolveGraphExtractConcurrency
} from './graph-extract-batch.util'
import {
  DEFAULT_GRAPH_EXTRACT_QUEUE_MESSAGES,
  type GraphExtractQueueEngineOptions,
  type GraphExtractQueueItem,
  type GraphExtractQueueMessages,
  type GraphExtractQueueRunner,
  type GraphExtractQueueSnapshot,
  type GraphExtractQueuedDraft
} from './graph-extract-queue-engine.types'

/**
 * In-memory extract queue. No Electron / storage deps — wrappers persist and broadcast.
 */
export abstract class GraphExtractQueueEngineBase {
  protected queue: GraphExtractQueueItem[] = []
  protected taskAborts = new Map<string, AbortController>()
  protected runner: GraphExtractQueueRunner | null = null
  protected stopped = false
  protected watchdog: ReturnType<typeof setInterval> | null = null
  protected kickTimer: ReturnType<typeof setTimeout> | null = null
  protected cleanupTimer: ReturnType<typeof setTimeout> | null = null
  protected progressTimer: ReturnType<typeof setTimeout> | null = null
  protected concurrency: number
  protected readonly alignPoolSize: number
  protected readonly cleanupMs: number
  protected readonly watchdogMs: number
  protected readonly progressThrottleMs: number
  protected readonly deferKick: boolean
  protected alignPool: GraphExtractQueuedDraft[] = []
  protected flushing = false
  protected flushAbort: AbortController | null = null
  protected flushGeneration = 0
  /** filePath → 取消时的正文哈希；空字符串表示拦截该路径直到用户手动再入队 */
  protected cancelledFollow = new Map<string, string>()

  constructor(protected readonly options: GraphExtractQueueEngineOptions = {}) {
    this.concurrency = resolveGraphExtractConcurrency(
      options.concurrency ?? GRAPH_EXTRACT_CONCURRENCY_DEFAULT
    )
    this.alignPoolSize = Math.max(1, options.alignPoolSize ?? GRAPH_EXTRACT_ALIGN_POOL_SIZE)
    this.cleanupMs = options.cleanupMs ?? 8000
    this.watchdogMs = options.watchdogMs ?? 2000
    this.progressThrottleMs = options.progressThrottleMs ?? 80
    this.deferKick = options.deferKick !== false
  }

  setConcurrency(value: unknown) {
    this.concurrency = resolveGraphExtractConcurrency(value)
    this.kickScheduleNext()
  }

  getConcurrency(): number {
    return this.concurrency
  }

  setRunner(runner: GraphExtractQueueRunner) {
    this.runner = runner
  }

  getQueueState(): GraphExtractQueueSnapshot {
    return this.snapshot()
  }

  get isRunning(): boolean {
    if (this.stopped) return false
    return this.flushing || this.queue.some((q) => isGraphExtractBusyStatus(q.status))
  }

  /**
   * 等到队列不再忙碌。入队后立刻调用即可把抽图收进同一条整理流水。
   * shouldContinue 返回 false 时停止等待（不改队列内容，由调用方决定是否 stop）。
   */
  async waitUntilIdle(options?: {
    pollMs?: number
    shouldContinue?: () => boolean | Promise<boolean>
    onProgress?: (state: GraphExtractQueueSnapshot) => void
  }): Promise<GraphExtractQueueSnapshot> {
    const pollMs = Math.max(0, options?.pollMs ?? 80)
    for (;;) {
      const state = this.snapshot()
      options?.onProgress?.(state)
      if (!this.isRunning) return state
      if (options?.shouldContinue && !(await options.shouldContinue())) return state
      if (pollMs === 0) {
        await Promise.resolve()
      } else {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, pollMs)
        })
      }
    }
  }

  stop() {
    this.stopped = true
    this.clearKick()
    this.clearWatchdog()
    this.clearCleanup()
    this.clearProgressTimer()
    this.flushGeneration += 1
    this.flushAbort?.abort()
    this.flushAbort = null
    this.flushing = false
    this.alignPool = []
    for (const item of this.queue) {
      this.rememberCancelledFollow(item)
      if (item.status === 'running') item.status = 'pending'
    }
    for (const ac of this.taskAborts.values()) ac.abort()
    this.taskAborts.clear()
    this.queue = []
    this.persistPending()
    this.broadcast()
  }

  cancelItem(filePath: string): boolean {
    const key = normalizeGraphFilePath(String(filePath || '').trim())
    const item = this.queue.find((q) => q.id === key || normalizeGraphFilePath(q.filePath) === key)
    if (!item) return false
    if (item.status === 'pending' || item.status === 'aligning') {
      this.rememberCancelledFollow(item)
      this.alignPool = this.alignPool.filter((d) => d.filePath !== item.filePath)
      this.queue = this.queue.filter((q) => q.id !== item.id)
      this.persistPending()
      this.broadcast()
      return true
    }
    if (item.status === 'running') {
      this.rememberCancelledFollow(item)
      item.status = 'pending'
      this.taskAborts.get(item.id)?.abort()
      this.queue = this.queue.filter((q) => q.id !== item.id)
      this.persistPending()
      this.broadcast()
      return true
    }
    return false
  }

  enqueue(items: Array<{ filePath: string; date?: string; contentHash?: string }>): number {
    return this.enqueueItems(items, { afterEmbed: false })
  }

  /**
   * 向量完成后的自动接续。忙碌中的不重复入队；用户刚取消的同正文不自己再排上。
   */
  enqueueAfterEmbed(
    items: Array<{ filePath: string; date?: string; contentHash?: string }>
  ): number {
    return this.enqueueItems(items, { afterEmbed: true })
  }

  protected rememberCancelledFollow(item: GraphExtractQueueItem): void {
    const key = normalizeGraphFilePath(item.filePath) || item.id
    if (!key) return
    this.cancelledFollow.set(key, String(item.contentHash || '').trim())
  }

  protected enqueueItems(
    items: Array<{ filePath: string; date?: string; contentHash?: string }>,
    opts: { afterEmbed: boolean }
  ): number {
    if (!this.runner) {
      throw new Error('Graph extract queue runner not configured')
    }
    if (!opts.afterEmbed) {
      this.stopped = false
    }

    let added = 0
    for (const item of items) {
      const filePath = normalizeGraphFilePath(String(item.filePath || '').trim())
      if (!filePath) continue
      const contentHash = String(item.contentHash || '').trim() || undefined
      if (!opts.afterEmbed) {
        this.cancelledFollow.delete(filePath)
      } else if (
        isDiaryGraphFollowCancelled({
          filePath,
          contentHash,
          cancelled: this.cancelledFollow
        })
      ) {
        continue
      }
      const existing = this.queue.find((q) => q.id === filePath)
      if (existing) {
        if (isGraphExtractBusyStatus(existing.status)) continue
        this.queue = this.queue.filter((q) => q.id !== filePath)
      }
      this.queue.push({
        id: filePath,
        filePath,
        date: item.date,
        contentHash,
        progress: 0,
        status: 'pending',
        phase: 'queued'
      })
      added++
    }

    if (added > 0) {
      this.stopped = false
      this.persistPending()
      this.broadcast()
    }
    if (!opts.afterEmbed || added > 0) {
      this.armWatchdog()
      this.scheduleNext()
    }
    return added
  }

  protected msg(): GraphExtractQueueMessages {
    return this.options.messages?.() ?? DEFAULT_GRAPH_EXTRACT_QUEUE_MESSAGES
  }

  protected snapshot(): GraphExtractQueueSnapshot {
    const items = this.queue.map((q) => ({ ...q }))
    const runningCount = items.filter((i) => i.status === 'running').length
    const aligningCount = items.filter((i) => i.status === 'aligning').length
    return {
      items,
      activeCount: runningCount + aligningCount,
      pendingCount: items.filter((i) => i.status === 'pending').length,
      runningCount,
      aligningCount,
      completedCount: items.filter((i) => i.status === 'completed').length,
      errorCount: items.filter((i) => i.status === 'error').length,
      overallProgress: graphExtractOverallProgress(items),
      alignPoolSize: this.alignPoolSize,
      alignPoolCount: this.alignPool.length
    }
  }

  protected persistPending() {
    const pending = this.queue
      .filter((q) => isGraphExtractBusyStatus(q.status))
      .map((q) => ({ filePath: q.filePath, date: q.date }))
    try {
      this.options.persist?.(pending)
    } catch {
      // wrapper logs
    }
  }

  protected broadcast() {
    try {
      this.options.broadcast?.(this.snapshot())
    } catch {
      // ignore
    }
  }

  protected broadcastProgress() {
    if (this.progressThrottleMs <= 0) {
      this.broadcast()
      return
    }
    if (this.progressTimer) return
    this.progressTimer = setTimeout(() => {
      this.progressTimer = null
      this.broadcast()
    }, this.progressThrottleMs)
  }

  protected clearProgressTimer() {
    if (this.progressTimer) {
      clearTimeout(this.progressTimer)
      this.progressTimer = null
    }
  }

  protected clearKick() {
    if (this.kickTimer) {
      clearTimeout(this.kickTimer)
      this.kickTimer = null
    }
  }

  protected clearWatchdog() {
    if (this.watchdog) {
      clearInterval(this.watchdog)
      this.watchdog = null
    }
  }

  protected clearCleanup() {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  protected armWatchdog() {
    if (this.watchdogMs <= 0 || this.watchdog) return
    this.watchdog = setInterval(() => {
      if (this.stopped) {
        this.clearWatchdog()
        return
      }
      const hasPending = this.queue.some((q) => q.status === 'pending')
      if (hasPending && this.taskAborts.size === 0) {
        for (const item of this.queue) {
          if (item.status === 'running') item.status = 'pending'
        }
        this.scheduleNext()
      }
      if (!hasPending && this.taskAborts.size === 0) {
        this.clearWatchdog()
      }
    }, this.watchdogMs)
  }

  protected kickScheduleNext() {
    if (this.stopped) return
    if (!this.deferKick) {
      this.scheduleNext()
      return
    }
    this.clearKick()
    this.kickTimer = setTimeout(() => {
      this.kickTimer = null
      this.scheduleNext()
    }, 0)
  }

  protected abstract scheduleNext(): void
}
