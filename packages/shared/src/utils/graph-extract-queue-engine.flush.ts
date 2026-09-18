import { normalizeGraphFilePath } from './graph-identity.util'
import {
  graphExtractPhaseProgress,
  isGraphExtractBusyStatus,
  type GraphExtractQueuePhase
} from './graph-extract-batch.util'
import { GraphExtractQueueEngineBase } from './graph-extract-queue-engine.base'
import type { GraphExtractQueuedDraft } from './graph-extract-queue-engine.types'

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

  protected applyFlushPhase(
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
