import type { SessionRepository } from '@baishou/database'
import { isVaultId, sanitizeSessionAggregateForDisk } from '@baishou/shared'
import type { SessionFileService } from './session-file.service'

export type SessionDiskFlushUrgency = 'immediate' | 'debounced'

export type SessionDiskPersistenceHooks = {
  /** 写入 JSON 前回调（可用于抑制 watcher 回环） */
  onBeforeWrite?: (sessionId: string, filePath: string) => Promise<void> | void
  /** 写入 JSON 完成且磁盘 mtime 落定后回调（刷新抑制窗口，防止写盘耗时吃掉抑制期） */
  onAfterWrite?: (sessionId: string, filePath: string) => Promise<void> | void
  /**
   * 会话 JSON 的 vaultName 快照。
   * 普通 flush 没有显式目标仓库时，先按 vaultId 查注册表，再回退当前活跃仓库；
   * 旧端依赖该字段导入。
   */
  resolveVaultName?: (vaultId: string) => Promise<string | null> | string | null
  resolveActiveVaultName?: () => Promise<string | null> | string | null
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

  hasPendingPersistence(sessionId: string): boolean {
    if (!sessionId) return false
    return (
      this.dirty.has(sessionId) ||
      this.debounceTimers.has(sessionId) ||
      this.inFlight.has(sessionId)
    )
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

    while (this.dirty.has(sessionId) && !this.discarded.has(sessionId)) {
      const pending = this.inFlight.get(sessionId)
      if (pending) {
        await pending
        continue
      }

      const task = this.flushSessionUnlocked(sessionId, options).finally(() => {
        if (this.inFlight.get(sessionId) === task) {
          this.inFlight.delete(sessionId)
        }
      })
      this.inFlight.set(sessionId, task)
      await task
    }
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

    try {
      const aggregate = await this.sessionRepo.getSessionAggregate(sessionId)
      // 在快照读取完成后清除 dirty；并发进入的 flushNow 合并为本次写盘，而写盘 I/O 期间的新变更会重新标记 dirty 并由外层循环补刷
      this.dirty.delete(sessionId)
      if (!aggregate) {
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

      // V2-D4: 新写入 dual-write vaultId + vaultName（名字快照）；不发明假 id
      const sessionObj =
        cleaned?.session && typeof cleaned.session === 'object'
          ? ({ ...(cleaned.session as Record<string, unknown>) } as Record<string, unknown>)
          : undefined
      if (sessionObj) {
        const rawId = String(sessionObj.vaultId ?? sessionObj.vault_id ?? '').trim()
        let fallbackVaultName: string | null = null
        if (!options?.vaultName?.trim() && !sessionObj.vaultName && !sessionObj.vault_name) {
          try {
            if (rawId) {
              fallbackVaultName = (await this.hooks?.resolveVaultName?.(rawId)) ?? null
            }
            if (!fallbackVaultName) {
              fallbackVaultName = (await this.hooks?.resolveActiveVaultName?.()) ?? null
            }
          } catch {
            fallbackVaultName = null
          }
        }
        const nameSnapshot =
          options?.vaultName?.trim() ||
          String(sessionObj.vaultName ?? sessionObj.vault_name ?? '').trim() ||
          fallbackVaultName?.trim() ||
          undefined
        if (rawId) {
          sessionObj.vaultId = isVaultId(rawId) ? rawId : rawId
          delete sessionObj.vault_id
        }
        if (nameSnapshot) {
          sessionObj.vaultName = nameSnapshot
          delete sessionObj.vault_name
        }
      }
      const enriched = sessionObj ? { ...cleaned, session: sessionObj } : cleaned

      await this.hooks?.onBeforeWrite?.(sessionId, sessionId)
      const targetVault = options?.vaultName?.trim()
      if (targetVault) {
        await this.fileService.writeSession(sessionId, enriched, targetVault)
      } else {
        await this.fileService.writeSession(sessionId, enriched)
      }
      await this.hooks?.onAfterWrite?.(sessionId, sessionId)
    } catch (error) {
      if (!this.discarded.has(sessionId)) {
        this.dirty.add(sessionId)
      }
      throw error
    }
  }
}
