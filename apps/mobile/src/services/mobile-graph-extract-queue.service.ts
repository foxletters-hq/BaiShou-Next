import i18n from 'i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  GraphExtractQueueEngine,
  GRAPH_EXTRACT_CONCURRENCY_DEFAULT,
  GRAPH_EXTRACT_CONCURRENCY_STORAGE_KEY,
  GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR,
  buildGraphExtractEnqueueItems,
  resolveGraphExtractConcurrency,
  type GraphExtractQueueSnapshot
} from '@baishou/shared'
import type { GraphExtractDraft } from '@baishou/core-mobile'
import type { AppDatabase, ShadowIndexRepository } from '@baishou/database'
import type { IFileSystem, IStoragePathService, SettingsManagerService } from '@baishou/core-mobile'
import {
  mobileCommitGraphDrafts,
  mobileExtractDraft,
  mobileListPendingReextract,
  resolveMobileGraphExtractAlignDeps
} from './mobile-graph.service'

export type {
  GraphExtractQueueItem,
  GraphExtractQueueSnapshot,
  GraphExtractQueueStatus
} from '@baishou/shared'

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

const STORAGE_KEY = 'baishou.graph.extractQueue.v1'

/**
 * Module-level queue so extract keeps running when GraphScreen unmounts.
 * Pending list persists in AsyncStorage (app data, not Vault).
 */
class MobileGraphExtractQueue {
  private readonly engine: GraphExtractQueueEngine
  private readonly listeners = new Set<Listener>()
  private context: MobileGraphExtractContext | null = null
  private restored = false

  constructor() {
    this.engine = new GraphExtractQueueEngine({
      concurrency: GRAPH_EXTRACT_CONCURRENCY_DEFAULT,
      persist: (pending) => {
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, pending }))
      },
      broadcast: (state) => {
        for (const listener of this.listeners) {
          try {
            listener(state)
          } catch {
            // ignore listener errors
          }
        }
      },
      messages: () => ({
        cancelled: i18n.t('graph.extract_user_cancelled', '用户取消了抽取'),
        failed: i18n.t('graph.extract_failed', '整理失败'),
        skipped: i18n.t('graph.extract_skipped', '已跳过（不在待重抽列表）')
      }),
      flushDrafts: async (items, signal, onPhase) => {
        const ctx = this.context
        if (!ctx) {
          throw new Error(i18n.t('graph.extract_queue_no_context', '图谱抽取队列未就绪'))
        }
        return mobileCommitGraphDrafts(
          ctx,
          items.map((item) => item.draft as GraphExtractDraft),
          signal,
          onPhase
        )
      }
    })
    this.engine.setRunner(async ({ filePath, signal, onProgress }) => {
      const ctx = this.context
      if (!ctx) {
        throw new Error(i18n.t('graph.extract_queue_no_context', '图谱抽取队列未就绪'))
      }
      const draft = await mobileExtractDraft({
        ...ctx,
        filePath,
        signal,
        onProgress
      })
      return { done: 1, failed: 0, errors: [], draft }
    })
    void this.restoreConcurrency()
  }

  private async restoreConcurrency() {
    try {
      const raw = await AsyncStorage.getItem(GRAPH_EXTRACT_CONCURRENCY_STORAGE_KEY)
      if (raw != null) this.engine.setConcurrency(raw)
    } catch {
      // keep default
    }
  }

  setConcurrency(value: unknown) {
    const n = resolveGraphExtractConcurrency(value)
    this.engine.setConcurrency(n)
    void AsyncStorage.setItem(GRAPH_EXTRACT_CONCURRENCY_STORAGE_KEY, String(n))
    return n
  }

  getConcurrency(): number {
    return this.engine.getConcurrency()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.engine.getQueueState())
    return () => {
      this.listeners.delete(listener)
    }
  }

  getQueueState(): GraphExtractQueueSnapshot {
    return this.engine.getQueueState()
  }

  get isRunning(): boolean {
    return this.engine.isRunning
  }

  setContext(ctx: MobileGraphExtractContext) {
    this.context = ctx
    void this.restoreFromStorage()
  }

  private async restoreFromStorage(): Promise<void> {
    if (this.restored || !this.context) return
    this.restored = true
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { pending?: Array<{ filePath: string; date?: string }> }
      const items = Array.isArray(parsed?.pending) ? parsed.pending : []
      if (items.length === 0) return
      await this.enqueue({ filePaths: items.map((i) => i.filePath) })
    } catch {
      // ignore
    }
  }

  stop() {
    this.engine.stop()
  }

  cancelItem(filePath: string): boolean {
    return this.engine.cancelItem(filePath)
  }

  async enqueue(
    opts?: { filePaths?: string[]; concurrency?: number },
    ctx?: MobileGraphExtractContext
  ): Promise<{ queued: number; totalPending: number; skippedNotEmbedded: string[] }> {
    if (ctx) this.context = ctx
    if (!this.context) {
      throw new Error(i18n.t('graph.extract_queue_no_context', '图谱抽取队列未就绪'))
    }
    if (opts?.concurrency != null) {
      this.setConcurrency(opts.concurrency)
    }

    const alignDeps = await resolveMobileGraphExtractAlignDeps(this.context)
    if (!(await alignDeps.isEmbeddingConfigured?.())) {
      throw new Error(GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR)
    }

    const pending = await mobileListPendingReextract({
      vaultName: this.context.vaultName,
      vaultId: this.context.vaultId,
      shadowRepo: this.context.shadowRepo,
      pathService: this.context.pathService,
      fileSystem: this.context.fileSystem
    })
    const wanted = opts?.filePaths?.length ? opts.filePaths : pending.map((p) => p.filePath)
    const { items, skippedNotEmbedded } = await buildGraphExtractEnqueueItems({
      wanted,
      pending,
      isDiaryEmbedded: alignDeps.isDiaryEmbedded
    })
    const queued = this.engine.enqueue(items)
    return { queued, totalPending: items.length, skippedNotEmbedded }
  }
}

export const mobileGraphExtractQueue = new MobileGraphExtractQueue()
