import type { SessionRepository } from '@baishou/database'
import { sanitizeSessionAggregateForDisk } from '@baishou/shared'
import type { SessionFileService } from './session-file.service'

export type SessionDiskFlushUrgency = 'immediate' | 'debounced'

export type SessionDiskPersistenceHooks = {
  /** 写入 JSON 前回调（桌面端可用于抑制 watcher 回环） */
  onBeforeWrite?: (sessionId: string, filePath: string) => void
}

/**
 * 会话 JSON 落盘调度器（对齐 SettingsManager 的 flush 管线）
 *
 * - 业务改 SQLite 后通过 markDirty / scheduleFlush / flushNow 登记落盘
 * - 同一 session 并发 flush 合并为单次写入
 * - quiesce / 增量同步前仅 flush 脏会话，而非全库扫描
 */
export class SessionDiskPersistenceService {
  private readonly dirty = new Set<string>()
  private readonly discarded = new Set<string>()
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly inFlight = new Map<string, Promise<void>>()

  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly fileService: SessionFileService,
    private readonly hooks?: SessionDiskPersistenceHooks,
    private readonly defaultDebounceMs = 400
  ) {}

  isDirty(sessionId: string): boolean {
    return this.dirty.has(sessionId)
  }

  getDirtySessionIds(): ReadonlySet<string> {
    return this.dirty
  }

  /** SQLite 已变更、JSON 尚未对齐时调用 */
  markDirty(sessionId: string): void {
    if (!sessionId) return
    this.discarded.delete(sessionId)
    this.dirty.add(sessionId)
  }

  /** 防抖落盘：适合流式结束后或高频连续写入 */
  scheduleFlush(sessionId: string, delayMs = this.defaultDebounceMs): void {
    if (!sessionId) return
    this.markDirty(sessionId)
    const existing = this.debounceTimers.get(sessionId)
    if (existing) clearTimeout(existing)
    this.debounceTimers.set(
      sessionId,
      setTimeout(() => {
        this.debounceTimers.delete(sessionId)
        void this.flushNow(sessionId)
      }, delayMs)
    )
  }

  cancelScheduledFlush(sessionId: string): void {
    const timer = this.debounceTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.debounceTimers.delete(sessionId)
    }
  }

  /**
   * 删除会话前作废待落盘：取消防抖、清 dirty；仅当有 in-flight flush 时标记 discarded。
   */
  discard(sessionId: string): void {
    if (!sessionId) return
    this.cancelScheduledFlush(sessionId)
    this.dirty.delete(sessionId)
    if (this.inFlight.has(sessionId)) {
      this.discarded.add(sessionId)
    } else {
      this.discarded.delete(sessionId)
    }
  }

  notifySessionMutated(sessionId: string, urgency: SessionDiskFlushUrgency = 'immediate'): void {
    if (urgency === 'debounced') {
      this.scheduleFlush(sessionId)
      return
    }
    void this.flushNow(sessionId)
  }

  async flushNow(sessionId: string, options?: { vaultName?: string | null }): Promise<void> {
    if (!sessionId) return
    this.cancelScheduledFlush(sessionId)
    this.markDirty(sessionId)

    const pending = this.inFlight.get(sessionId)
    if (pending) {
      await pending
      if (!this.dirty.has(sessionId)) return
    }

    const task = this.flushSessionUnlocked(sessionId, options).finally(() => {
      if (this.inFlight.get(sessionId) === task) {
        this.inFlight.delete(sessionId)
      }
    })
    this.inFlight.set(sessionId, task)
    await task
  }

  /** 仅落盘脏会话（存储静默、增量同步扫描 manifest 前） */
  async flushPending(): Promise<void> {
    for (const sessionId of this.debounceTimers.keys()) {
      this.cancelScheduledFlush(sessionId)
    }
    const ids = [...this.dirty]
    if (ids.length === 0) return
    const results = await Promise.allSettled(ids.map((sessionId) => this.flushNow(sessionId)))
    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      const first = failed[0] as PromiseRejectedResult
      throw first.reason instanceof Error ? first.reason : new Error(String(first.reason))
    }
  }

  private async flushSessionUnlocked(
    sessionId: string,
    options?: { vaultName?: string | null }
  ): Promise<void> {
    if (this.discarded.has(sessionId)) {
      this.discarded.delete(sessionId)
      this.dirty.delete(sessionId)
      return
    }

    const aggregate = await this.sessionRepo.getSessionAggregate(sessionId)
    if (!aggregate) {
      this.dirty.delete(sessionId)
      return
    }

    if (this.discarded.has(sessionId)) {
      this.discarded.delete(sessionId)
      this.dirty.delete(sessionId)
      return
    }

    const { aggregate: cleaned, partUpdates } = sanitizeSessionAggregateForDisk(aggregate)
    if (partUpdates.length > 0 && typeof this.sessionRepo.updatePartsDataById === 'function') {
      await this.sessionRepo.updatePartsDataById(partUpdates)
    }

    if (this.discarded.has(sessionId)) {
      this.discarded.delete(sessionId)
      this.dirty.delete(sessionId)
      return
    }

    this.hooks?.onBeforeWrite?.(sessionId, sessionId)
    await this.fileService.writeSession(sessionId, cleaned, options?.vaultName)
    this.dirty.delete(sessionId)
  }
}
