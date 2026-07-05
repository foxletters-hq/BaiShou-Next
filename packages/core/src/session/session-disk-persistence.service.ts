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

  notifySessionMutated(sessionId: string, urgency: SessionDiskFlushUrgency = 'immediate'): void {
    if (urgency === 'debounced') {
      this.scheduleFlush(sessionId)
      return
    }
    void this.flushNow(sessionId)
  }

  async flushNow(sessionId: string): Promise<void> {
    if (!sessionId) return
    this.cancelScheduledFlush(sessionId)
    this.markDirty(sessionId)

    const pending = this.inFlight.get(sessionId)
    if (pending) {
      await pending
      if (!this.dirty.has(sessionId)) return
    }

    const task = this.flushSessionUnlocked(sessionId).finally(() => {
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
    await Promise.all(ids.map((sessionId) => this.flushNow(sessionId)))
  }

  private async flushSessionUnlocked(sessionId: string): Promise<void> {
    const aggregate = await this.sessionRepo.getSessionAggregate(sessionId)
    if (!aggregate) {
      this.dirty.delete(sessionId)
      return
    }

    const { aggregate: cleaned, partUpdates } = sanitizeSessionAggregateForDisk(aggregate)
    if (partUpdates.length > 0 && typeof this.sessionRepo.updatePartsDataById === 'function') {
      await this.sessionRepo.updatePartsDataById(partUpdates)
    }

    this.hooks?.onBeforeWrite?.(sessionId, sessionId)
    await this.fileService.writeSession(sessionId, cleaned)
    this.dirty.delete(sessionId)
  }
}
