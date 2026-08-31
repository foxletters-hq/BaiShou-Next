import { normalizeGraphFilePath } from './graph-identity.util'
import {
  GRAPH_EXTRACT_ALIGN_POOL_SIZE,
  GRAPH_EXTRACT_CONCURRENCY_DEFAULT,
  graphExtractOverallProgress,
  graphExtractPhaseProgress,
  isGraphExtractBusyStatus,
  resolveGraphExtractConcurrency,
  type GraphExtractQueuePhase
} from './graph-extract-batch.util'

export type GraphExtractQueueStatus = 'pending' | 'running' | 'aligning' | 'completed' | 'error'

export interface GraphExtractQueueItem {
  id: string
  filePath: string
  date?: string
  progress: number
  status: GraphExtractQueueStatus
  phase?: GraphExtractQueuePhase
  phaseDetail?: string
  error?: string
}

export type GraphExtractQueueSnapshot = {
  items: GraphExtractQueueItem[]
  activeCount: number
  pendingCount: number
  runningCount: number
  aligningCount: number
  completedCount: number
  errorCount: number
  overallProgress: number
  alignPoolSize: number
  alignPoolCount: number
}

export function emptyGraphExtractQueueSnapshot(
  alignPoolSize = GRAPH_EXTRACT_ALIGN_POOL_SIZE
): GraphExtractQueueSnapshot {
  return {
    items: [],
    activeCount: 0,
    pendingCount: 0,
    runningCount: 0,
    aligningCount: 0,
    completedCount: 0,
    errorCount: 0,
    overallProgress: 0,
    alignPoolSize,
    alignPoolCount: 0
  }
}

export type GraphExtractQueueRunnerResult = {
  done: number
  failed: number
  cancelled?: boolean
  errors: Array<{ filePath: string; message: string }>
  draft?: unknown
}

export type GraphExtractQueueProgressUpdate = {
  progress?: number
  phase?: GraphExtractQueuePhase
  detail?: string
}

export type GraphExtractQueueRunner = (opts: {
  filePath: string
  signal: AbortSignal
  onProgress?: (update: GraphExtractQueueProgressUpdate) => void
}) => Promise<GraphExtractQueueRunnerResult>

export type GraphExtractQueuedDraft = { filePath: string; draft: unknown }

export type GraphExtractQueueFlushDrafts = (
  drafts: GraphExtractQueuedDraft[],
  signal?: AbortSignal,
  onPhase?: (phase: GraphExtractQueuePhase, detail?: string) => void
) => Promise<Array<{ filePath: string; error?: string }>>

export type GraphExtractQueueMessages = {
  cancelled: string
  failed: string
  skipped: string
}

export type GraphExtractQueueEngineOptions = {
  persist?: (pending: Array<{ filePath: string; date?: string }>) => void
  broadcast?: (state: GraphExtractQueueSnapshot) => void
  messages?: () => GraphExtractQueueMessages
  concurrency?: number
  alignPoolSize?: number
  flushDrafts?: GraphExtractQueueFlushDrafts
  cleanupMs?: number
  watchdogMs?: number
  /** 流式进度广播间隔；0 = 立即广播（测试）。 */
  progressThrottleMs?: number
  /** false = schedule the next job in the same turn (tests). */
  deferKick?: boolean
}

const DEFAULT_MESSAGES: GraphExtractQueueMessages = {
  cancelled: '用户取消了抽取',
  failed: '整理失败',
  skipped: '已跳过（不在待重抽列表）'
}

/**
 * In-memory extract queue. No Electron / storage deps — wrappers persist and broadcast.
 */
export class GraphExtractQueueEngine {
  private queue: GraphExtractQueueItem[] = []
  private taskAborts = new Map<string, AbortController>()
  private runner: GraphExtractQueueRunner | null = null
  private stopped = false
  private watchdog: ReturnType<typeof setInterval> | null = null
  private kickTimer: ReturnType<typeof setTimeout> | null = null
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null
  private progressTimer: ReturnType<typeof setTimeout> | null = null
  private concurrency: number
  private readonly alignPoolSize: number
  private readonly cleanupMs: number
  private readonly watchdogMs: number
  private readonly progressThrottleMs: number
  private readonly deferKick: boolean
  private alignPool: GraphExtractQueuedDraft[] = []
  private flushing = false
  private flushAbort: AbortController | null = null
  private flushGeneration = 0

  constructor(private readonly options: GraphExtractQueueEngineOptions = {}) {
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
      this.alignPool = this.alignPool.filter((d) => d.filePath !== item.filePath)
      this.queue = this.queue.filter((q) => q.id !== item.id)
      this.persistPending()
      this.broadcast()
      return true
    }
    if (item.status === 'running') {
      item.status = 'pending'
      this.taskAborts.get(item.id)?.abort()
      this.queue = this.queue.filter((q) => q.id !== item.id)
      this.persistPending()
      this.broadcast()
      return true
    }
    return false
  }

  enqueue(items: Array<{ filePath: string; date?: string }>): number {
    if (!this.runner) {
      throw new Error('Graph extract queue runner not configured')
    }
    this.stopped = false

    let added = 0
    for (const item of items) {
      const filePath = normalizeGraphFilePath(String(item.filePath || '').trim())
      if (!filePath) continue
      const existing = this.queue.find((q) => q.id === filePath)
      if (existing) {
        if (isGraphExtractBusyStatus(existing.status)) continue
        this.queue = this.queue.filter((q) => q.id !== filePath)
      }
      this.queue.push({
        id: filePath,
        filePath,
        date: item.date,
        progress: 0,
        status: 'pending',
        phase: 'queued'
      })
      added++
    }

    if (added > 0) {
      this.persistPending()
      this.broadcast()
    }
    this.armWatchdog()
    this.scheduleNext()
    return added
  }

  private msg(): GraphExtractQueueMessages {
    return this.options.messages?.() ?? DEFAULT_MESSAGES
  }

  private snapshot(): GraphExtractQueueSnapshot {
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

  private persistPending() {
    const pending = this.queue
      .filter((q) => isGraphExtractBusyStatus(q.status))
      .map((q) => ({ filePath: q.filePath, date: q.date }))
    try {
      this.options.persist?.(pending)
    } catch {
      // wrapper logs
    }
  }

  private broadcast() {
    try {
      this.options.broadcast?.(this.snapshot())
    } catch {
      // ignore
    }
  }

  private broadcastProgress() {
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

  private clearProgressTimer() {
    if (this.progressTimer) {
      clearTimeout(this.progressTimer)
      this.progressTimer = null
    }
  }

  private clearKick() {
    if (this.kickTimer) {
      clearTimeout(this.kickTimer)
      this.kickTimer = null
    }
  }

  private clearWatchdog() {
    if (this.watchdog) {
      clearInterval(this.watchdog)
      this.watchdog = null
    }
  }

  private clearCleanup() {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  private armWatchdog() {
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

  private kickScheduleNext() {
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

  private scheduleNext() {
    if (this.stopped || this.flushing) return
    if (this.taskAborts.size === 0) {
      for (const item of this.queue) {
        if (item.status === 'running') item.status = 'pending'
      }
    }
    while (this.taskAborts.size < this.concurrency) {
      if (this.uncommittedCount() >= this.alignPoolSize) break
      const next = this.queue.find((q) => q.status === 'pending')
      if (!next) break
      next.status = 'running'
      next.phase = 'reading'
      next.progress = graphExtractPhaseProgress('reading')
      next.phaseDetail = undefined
      this.persistPending()
      this.broadcast()
      void this.processTask(next)
    }
    if (!this.hasLlmWork() && this.alignPool.length > 0) {
      void this.maybeFlush()
    }
  }

  private uncommittedCount(): number {
    return this.queue.filter((q) => q.status === 'running' || q.status === 'aligning').length
  }

  private hasLlmWork(): boolean {
    return this.queue.some((q) => q.status === 'pending' || q.status === 'running')
  }

  private hasOpenWork(): boolean {
    return this.flushing || this.queue.some((q) => isGraphExtractBusyStatus(q.status))
  }

  private releaseTaskAbort(taskId: string, ac: AbortController) {
    if (this.taskAborts.get(taskId) === ac) this.taskAborts.delete(taskId)
  }

  private dropTask(task: GraphExtractQueueItem) {
    this.queue = this.queue.filter((q) => q !== task)
  }

  private async processTask(task: GraphExtractQueueItem) {
    const runner = this.runner
    const ac = new AbortController()
    this.taskAborts.set(task.id, ac)
    const signal = ac.signal

    if (!runner || this.stopped) {
      this.releaseTaskAbort(task.id, ac)
      this.dropTask(task)
      if (!this.stopped) this.kickScheduleNext()
      return
    }

    try {
      task.status = 'running'
      task.phase = 'reading'
      task.progress = graphExtractPhaseProgress('reading')
      task.phaseDetail = undefined
      this.broadcast()

      if (signal.aborted || this.stopped) {
        throw new Error(this.msg().cancelled)
      }

      const result = await runner({
        filePath: task.filePath,
        signal,
        onProgress: (update) => {
          if (task.status !== 'running') return
          const nextPhase = update.phase ?? task.phase
          const nextProgress = graphExtractPhaseProgress(nextPhase) || task.progress
          const nextDetail = nextPhase === 'waiting_pool' ? update.detail ?? task.phaseDetail : undefined
          if (
            nextPhase === task.phase &&
            nextDetail === task.phaseDetail &&
            nextProgress === task.progress
          ) {
            return
          }
          task.phase = nextPhase
          task.phaseDetail = nextDetail
          task.progress = nextProgress
          this.broadcast()
        }
      })

      if (signal.aborted || this.stopped) {
        this.dropTask(task)
        this.broadcast()
        return
      }

      if (result.cancelled && result.done === 0) {
        this.dropTask(task)
        this.broadcast()
        return
      }

      if (result.failed > 0 && result.done === 0) {
        task.status = 'error'
        task.error = result.errors[0]?.message || this.msg().failed
        task.progress = 100
        task.phase = undefined
        task.phaseDetail = undefined
        this.broadcast()
        return
      }

      if (result.done === 0) {
        task.status = 'error'
        task.error = this.msg().skipped
        task.progress = 100
        task.phase = undefined
        task.phaseDetail = undefined
        this.broadcast()
        return
      }

      if (result.draft != null && this.options.flushDrafts) {
        task.status = 'aligning'
        task.phase = 'waiting_pool'
        task.progress = graphExtractPhaseProgress('waiting_pool')
        this.alignPool.push({ filePath: task.filePath, draft: result.draft })
        this.markWaitingPool()
        this.broadcast()
        return
      }

      task.status = 'completed'
      task.progress = 100
      task.phase = undefined
      task.phaseDetail = undefined
      this.broadcast()
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string }
      if (signal.aborted || this.stopped || err?.name === 'AbortError') {
        this.dropTask(task)
      } else {
        task.status = 'error'
        task.error = err?.message || String(e)
        task.phase = undefined
        task.phaseDetail = undefined
      }
      this.broadcast()
    } finally {
      this.releaseTaskAbort(task.id, ac)
      this.persistPending()
      if (!this.stopped) {
        void this.afterTaskSettled()
      }
    }
  }

  private async afterTaskSettled() {
    await this.maybeFlush()
    if (!this.stopped) this.kickScheduleNext()
    if (!this.hasOpenWork() && this.taskAborts.size === 0 && this.cleanupMs > 0) {
      this.clearCleanup()
      this.cleanupTimer = setTimeout(() => {
        this.cleanupTimer = null
        if (this.hasOpenWork() || this.taskAborts.size > 0) return
        this.queue = this.queue.filter((q) => isGraphExtractBusyStatus(q.status))
        this.persistPending()
        this.broadcast()
      }, this.cleanupMs)
    }
  }

  private markWaitingPool() {
    const current = this.alignPool.length
    const size = this.alignPoolSize
    for (const item of this.queue) {
      if (item.status !== 'aligning') continue
      if (
        item.phase === 'recalling' ||
        item.phase === 'waiting_align' ||
        item.phase === 'aligning' ||
        item.phase === 'writing'
      ) {
        continue
      }
      item.phase = 'waiting_pool'
      item.phaseDetail = `${current}/${size}`
      item.progress = graphExtractPhaseProgress('waiting_pool')
    }
  }

  private applyFlushPhase(
    batch: GraphExtractQueuedDraft[],
    phase: GraphExtractQueuePhase,
    detail?: string
  ) {
    for (const item of batch) {
      const task = this.queue.find(
        (q) => normalizeGraphFilePath(q.filePath) === normalizeGraphFilePath(item.filePath)
      )
      if (!task || task.status !== 'aligning') continue
      task.phase = phase
      task.phaseDetail = phase === 'waiting_pool' ? detail : undefined
      task.progress = graphExtractPhaseProgress(phase)
    }
  }

  private async maybeFlush() {
    const flushDrafts = this.options.flushDrafts
    if (!flushDrafts || this.flushing || this.stopped || this.alignPool.length === 0) return
    const full = this.alignPool.length >= this.alignPoolSize
    const drained = !this.hasLlmWork()
    if (!full && !drained) return

    this.flushing = true
    const flushGeneration = ++this.flushGeneration
    const ac = new AbortController()
    this.flushAbort = ac
    const batch = this.alignPool.splice(0, this.alignPool.length)
    this.applyFlushPhase(batch, 'recalling')
    this.markWaitingPool()
    this.broadcast()
    try {
      const results = await flushDrafts(batch, ac.signal, (phase, detail) => {
        if (this.flushGeneration !== flushGeneration || this.stopped) return
        this.applyFlushPhase(batch, phase, detail)
        this.broadcast()
      })
      if (this.flushGeneration !== flushGeneration || this.stopped || ac.signal.aborted) return
      const byPath = new Map(results.map((r) => [normalizeGraphFilePath(r.filePath), r]))
      for (const item of batch) {
        const task = this.queue.find(
          (q) => normalizeGraphFilePath(q.filePath) === normalizeGraphFilePath(item.filePath)
        )
        if (!task || task.status !== 'aligning') continue
        const result = byPath.get(normalizeGraphFilePath(item.filePath))
        if (result?.error) {
          task.status = 'error'
          task.error = result.error
          task.progress = 100
          task.phase = undefined
          task.phaseDetail = undefined
        } else {
          task.status = 'completed'
          task.progress = 100
          task.phase = undefined
          task.phaseDetail = undefined
        }
      }
    } catch (e: unknown) {
      if (this.flushGeneration !== flushGeneration || this.stopped || ac.signal.aborted) return
      const message = e instanceof Error ? e.message : String(e)
      for (const item of batch) {
        const task = this.queue.find(
          (q) => normalizeGraphFilePath(q.filePath) === normalizeGraphFilePath(item.filePath)
        )
        if (!task || task.status !== 'aligning') continue
        task.status = 'error'
        task.error = message
        task.progress = 100
        task.phase = undefined
        task.phaseDetail = undefined
      }
    } finally {
      if (this.flushGeneration === flushGeneration) {
        this.flushing = false
        if (this.flushAbort === ac) this.flushAbort = null
      }
      this.persistPending()
      this.broadcast()
    }
  }
}
