import i18n from 'i18next'
import { app, BrowserWindow } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  GraphExtractQueueEngine,
  GRAPH_EXTRACT_CONCURRENCY_DEFAULT,
  logger,
  type GraphExtractQueueFlushDrafts,
  type GraphExtractQueueRunner,
  type GraphExtractQueueSnapshot
} from '@baishou/shared'
import type { GraphLlmExtractionService } from '@baishou/core-desktop'

export type {
  GraphExtractQueueItem,
  GraphExtractQueueSnapshot,
  GraphExtractQueueStatus
} from '@baishou/shared'

type PersistedQueue = {
  schemaVersion: 1
  pending: Array<{ filePath: string; date?: string }>
}

/**
 * Main-process background queue for graph diary extraction.
 * Pending list persists under app userData; unfinished items are re-queued on restart.
 * Explicit stop aborts in-flight model streams and drops the queue.
 */
export class GraphExtractQueueService {
  private static instance: GraphExtractQueueService
  private readonly engine: GraphExtractQueueEngine
  private restored = false

  private flushDrafts: GraphExtractQueueFlushDrafts | null = null

  private constructor() {
    this.engine = new GraphExtractQueueEngine({
      concurrency: GRAPH_EXTRACT_CONCURRENCY_DEFAULT,
      persist: (pending) => this.writePending(pending),
      broadcast: (state) => this.sendState(state),
      messages: () => ({
        cancelled: i18n.t('graph.extract_user_cancelled', '用户取消了抽取'),
        failed: i18n.t('graph.extract_failed', '整理失败'),
        skipped: i18n.t('graph.extract_skipped', '已跳过（不在待重抽列表）')
      }),
      flushDrafts: (drafts, signal, onPhase) => {
        if (!this.flushDrafts) {
          throw new Error('Graph extract flush is not configured')
        }
        return this.flushDrafts(drafts, signal, onPhase)
      }
    })
  }

  static getInstance(): GraphExtractQueueService {
    if (!GraphExtractQueueService.instance) {
      GraphExtractQueueService.instance = new GraphExtractQueueService()
    }
    return GraphExtractQueueService.instance
  }

  private persistPath(): string {
    return path.join(app.getPath('userData'), 'graph-extract-queue.json')
  }

  private writePending(pending: Array<{ filePath: string; date?: string }>): void {
    try {
      const payload: PersistedQueue = { schemaVersion: 1, pending }
      fs.writeFileSync(this.persistPath(), JSON.stringify(payload), 'utf8')
    } catch (e) {
      logger.warn('[GraphExtractQueue] persist failed:', e as Error)
    }
  }

  private sendState(state: GraphExtractQueueSnapshot) {
    BrowserWindow.getAllWindows().forEach((win) => {
      try {
        win.webContents.send('graph:queue-progress', state)
      } catch {
        // window may be gone
      }
    })
  }

  /** Restore pending jobs from userData (call once after setRunner). */
  restoreFromDisk(): number {
    if (this.restored) return 0
    this.restored = true
    try {
      const file = this.persistPath()
      if (!fs.existsSync(file)) return 0
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as PersistedQueue
      const items = Array.isArray(raw?.pending) ? raw.pending : []
      if (items.length === 0) return 0
      return this.enqueue(items)
    } catch (e) {
      logger.warn('[GraphExtractQueue] restore failed:', e as Error)
      return 0
    }
  }

  setRunner(runner: GraphExtractQueueRunner) {
    this.engine.setRunner(runner)
    if (this.flushDrafts) this.restoreFromDisk()
  }

  setFlushDrafts(flushDrafts: GraphExtractQueueFlushDrafts) {
    this.flushDrafts = flushDrafts
  }

  setConcurrency(value: unknown) {
    this.engine.setConcurrency(value)
  }

  getConcurrency(): number {
    return this.engine.getConcurrency()
  }

  getQueueState(): GraphExtractQueueSnapshot {
    return this.engine.getQueueState()
  }

  get isRunning(): boolean {
    return this.engine.isRunning
  }

  stop() {
    this.engine.stop()
  }

  cancelItem(filePath: string): boolean {
    return this.engine.cancelItem(filePath)
  }

  enqueue(items: Array<{ filePath: string; date?: string }>): number {
    return this.engine.enqueue(items)
  }
}

export type { GraphLlmExtractionService }
