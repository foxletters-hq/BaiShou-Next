import { graphExtractPhaseProgress, isGraphExtractBusyStatus } from './graph-extract-batch.util'
import { GraphExtractQueueEngineFlushMixin } from './graph-extract-queue-engine.flush'
import type { GraphExtractQueueItem } from './graph-extract-queue-engine.types'

export type {
  GraphExtractQueueEngineOptions,
  GraphExtractQueueFlushDrafts,
  GraphExtractQueueItem,
  GraphExtractQueueMessages,
  GraphExtractQueueProgressUpdate,
  GraphExtractQueueRunner,
  GraphExtractQueueRunnerResult,
  GraphExtractQueueSnapshot,
  GraphExtractQueueStatus,
  GraphExtractQueuedDraft
} from './graph-extract-queue-engine.types'
export { emptyGraphExtractQueueSnapshot } from './graph-extract-queue-engine.types'

export class GraphExtractQueueEngine extends GraphExtractQueueEngineFlushMixin {
  protected scheduleNext() {
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
          const nextDetail =
            nextPhase === 'waiting_pool' ? (update.detail ?? task.phaseDetail) : undefined
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
          this.broadcastProgress()
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
}
