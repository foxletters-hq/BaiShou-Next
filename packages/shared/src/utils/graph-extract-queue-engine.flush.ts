import { normalizeGraphFilePath } from './graph-identity.util'
import {
  graphExtractPhaseProgress,
  isGraphExtractBusyStatus,
  type GraphExtractQueuePhase
} from './graph-extract-batch.util'
import { GraphExtractQueueEngineBase } from './graph-extract-queue-engine.base'
import type { GraphExtractQueuedDraft } from './graph-extract-queue-engine.types'
import { logger } from './logger'

export abstract class GraphExtractQueueEngineFlushMixin extends GraphExtractQueueEngineBase {
  protected uncommittedCount(): number {
    return this.queue.filter((q) => q.status === 'running' || q.status === 'aligning').length
  }

  protected hasLlmWork(): boolean {
    return this.queue.some((q) => q.status === 'pending' || q.status === 'running')
  }

  protected hasOpenWork(): boolean {
    return this.flushing || this.queue.some((q) => isGraphExtractBusyStatus(q.status))
  }

  protected markWaitingPool() {
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

  protected buildAligningTaskMap(): Map<string, (typeof this.queue)[number]> {
    const map = new Map<string, (typeof this.queue)[number]>()
    for (const q of this.queue) {
      if (q.status === 'aligning') {
        map.set(q.id || normalizeGraphFilePath(q.filePath), q)
      }
    }
    return map
  }

  protected applyFlushPhase(
    batch: GraphExtractQueuedDraft[],
    phase: GraphExtractQueuePhase,
    detail?: string
  ) {
    const aligningMap = this.buildAligningTaskMap()
    for (const item of batch) {
      const task = aligningMap.get(normalizeGraphFilePath(item.filePath))
      if (!task || task.status !== 'aligning') continue
      task.phase = phase
      task.phaseDetail = phase === 'waiting_pool' ? detail : undefined
      task.progress = graphExtractPhaseProgress(phase)
    }
  }

  protected async maybeFlush() {
    const flushDrafts = this.options.flushDrafts
    if (!flushDrafts || this.flushing || this.stopped || this.alignPool.length === 0) return
    const full = this.alignPool.length >= this.alignPoolSize
    const drained = !this.hasLlmWork()
    if (!full && !drained) return

    this.flushing = true
    const flushGeneration = ++this.flushGeneration
    const ac = new AbortController()
    this.flushAbort = ac
    let pendingBatch = this.alignPool.splice(0, this.alignPool.length)
    this.applyFlushPhase(pendingBatch, 'recalling')
    this.markWaitingPool()
    this.broadcast()
    this.kickScheduleNext()
    let haltedWithError: { ids: Set<string>; message: string } | null = null
    try {
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        if (this.flushGeneration !== flushGeneration || this.stopped || ac.signal.aborted) return
        if (attempt > 0) {
          if (this.retryDelayMs > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, this.retryDelayMs))
          }
          if (this.flushGeneration !== flushGeneration || this.stopped || ac.signal.aborted) return
          this.applyFlushPhase(pendingBatch, 'recalling')
          this.broadcast()
        }
        try {
          const results = await flushDrafts(pendingBatch, ac.signal, (phase, detail) => {
            if (this.flushGeneration !== flushGeneration || this.stopped) return
            this.applyFlushPhase(pendingBatch, phase, detail)
            this.broadcast()
          })
          if (this.flushGeneration !== flushGeneration || this.stopped || ac.signal.aborted) return
          const byPath = new Map(results.map((r) => [normalizeGraphFilePath(r.filePath), r]))
          const aligningMap = this.buildAligningTaskMap()
          const retryDrafts: GraphExtractQueuedDraft[] = []
          const failedIds = new Set<string>()
          let firstErrorMessage = ''

          for (const item of pendingBatch) {
            const normPath = normalizeGraphFilePath(item.filePath)
            const task = aligningMap.get(normPath)
            if (!task || task.status !== 'aligning') continue
            const result = byPath.get(normPath)
            if (result?.error) {
              if (attempt < this.maxRetries) {
                task.retryCount = attempt + 1
                retryDrafts.push(item)
              } else {
                task.status = 'error'
                task.error = result.error
                task.progress = 0
                task.phase = undefined
                task.phaseDetail = undefined
                failedIds.add(task.id)
                if (!firstErrorMessage) firstErrorMessage = result.error
                logger.warn('[GraphExtractQueue] flush item failed after retries', {
                  filePath: task.filePath,
                  retries: attempt,
                  error: result.error
                })
              }
            } else {
              task.status = 'completed'
              task.progress = 100
              task.phase = undefined
              task.phaseDetail = undefined
            }
          }

          if (retryDrafts.length > 0) {
            pendingBatch = retryDrafts
            logger.warn('[GraphExtractQueue] retrying failed flush items', {
              attempt: attempt + 1,
              maxRetries: this.maxRetries,
              drafts: retryDrafts.length
            })
            continue
          }

          if (failedIds.size > 0 && firstErrorMessage) {
            haltedWithError = { ids: failedIds, message: firstErrorMessage }
          }
          break
        } catch (e: unknown) {
          if (this.flushGeneration !== flushGeneration || this.stopped || ac.signal.aborted) return
          const message = e instanceof Error ? e.message : String(e)
          const aligningMap = this.buildAligningTaskMap()
          if (attempt < this.maxRetries) {
            for (const item of pendingBatch) {
              const task = aligningMap.get(normalizeGraphFilePath(item.filePath))
              if (task) task.retryCount = attempt + 1
            }
            logger.warn('[GraphExtractQueue] retrying flush batch after error', {
              attempt: attempt + 1,
              maxRetries: this.maxRetries,
              drafts: pendingBatch.length,
              error: message
            })
            continue
          }
          logger.warn('[GraphExtractQueue] flush batch failed after retries', {
            drafts: pendingBatch.length,
            retries: attempt,
            error: message
          })
          const failedIds = new Set<string>()
          for (const item of pendingBatch) {
            const task = aligningMap.get(normalizeGraphFilePath(item.filePath))
            if (!task || task.status !== 'aligning') continue
            task.status = 'error'
            task.error = message
            task.progress = 0
            task.phase = undefined
            task.phaseDetail = undefined
            failedIds.add(task.id)
          }
          haltedWithError = { ids: failedIds, message }
          break
        }
      }
    } finally {
      if (this.flushGeneration === flushGeneration) {
        this.flushing = false
        if (this.flushAbort === ac) this.flushAbort = null
      }
      if (haltedWithError) {
        this.haltOnFatalError(haltedWithError.ids, haltedWithError.message)
      } else {
        this.persistPending()
        this.broadcast()
        if (!this.stopped) {
          this.kickScheduleNext()
          if (
            this.alignPool.length >= this.alignPoolSize ||
            (!this.hasLlmWork() && this.alignPool.length > 0)
          ) {
            void this.maybeFlush()
          }
        }
      }
    }
  }
}
