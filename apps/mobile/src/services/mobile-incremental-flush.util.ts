import type { SyncManifest } from '@baishou/shared'
import type { IncrementalSyncSessionMode } from './mobile-incremental-sync-session.util'
import { REMOTE_MANIFEST_CHECKPOINT_BATCH_SIZE } from './mobile-incremental-sync-progress.util'

/** 本地 manifest / snapshot 批量落盘间隔 */
export const LOCAL_CHECKPOINT_FLUSH_INTERVAL_MS = 1000

/** sync-session 批量写入间隔 */
export const SESSION_FLUSH_INTERVAL_MS = 1000

/** sync-session 每处理 N 个决策强制写一次 */
export const SESSION_FLUSH_EVERY_N = 10

/** 本地 checkpoint 每 N 次变更强制写一次 */
export const LOCAL_CHECKPOINT_FLUSH_EVERY_N = 8

export class ThrottledIncrementalFlush {
  private sinceLastFlush = 0
  private firstBumpAt = 0

  bump(): void {
    if (this.sinceLastFlush === 0) {
      this.firstBumpAt = Date.now()
    }
    this.sinceLastFlush++
  }

  shouldFlush(force: boolean, everyN: number, intervalMs: number): boolean {
    if (force) return this.sinceLastFlush > 0
    if (this.sinceLastFlush <= 0) return false
    if (this.sinceLastFlush >= everyN) return true
    return Date.now() - this.firstBumpAt >= intervalMs
  }

  markFlushed(): void {
    this.sinceLastFlush = 0
    this.firstBumpAt = 0
  }
}

export type SessionTouchState = {
  metaDir: string
  mode: IncrementalSyncSessionMode
  total: number
  completed: number
  lastFile?: string
  startedAt?: number
}

/** 同步执行期：本地 manifest、远端 manifest、session 批量 flush */
export class IncrementalSyncCheckpointCoordinator {
  private localFlush = new ThrottledIncrementalFlush()
  private sessionFlush = new ThrottledIncrementalFlush()
  pendingRemoteManifest = 0
  private pendingLocalManifest: SyncManifest | null = null
  private pendingSession: SessionTouchState | null = null

  noteManifest(manifest: SyncManifest): void {
    this.pendingLocalManifest = manifest
    this.localFlush.bump()
  }

  noteRemoteCheckpoint(): void {
    this.pendingRemoteManifest++
  }

  noteSession(state: SessionTouchState): void {
    this.pendingSession = state
    this.sessionFlush.bump()
  }

  async flushLocalIfNeeded(
    force: boolean,
    saveLocal: (manifest: SyncManifest) => Promise<void>,
    saveSnapshot: (manifest: SyncManifest) => Promise<void>
  ): Promise<void> {
    const manifest = this.pendingLocalManifest
    if (!manifest) return
    if (
      !this.localFlush.shouldFlush(
        force,
        LOCAL_CHECKPOINT_FLUSH_EVERY_N,
        LOCAL_CHECKPOINT_FLUSH_INTERVAL_MS
      )
    ) {
      return
    }
    await saveLocal(manifest)
    await saveSnapshot(manifest)
    this.localFlush.markFlushed()
  }

  async flushRemoteIfNeeded(
    force: boolean,
    uploadRemote: () => Promise<void>,
    ensureLocalFlushed: () => Promise<void>
  ): Promise<void> {
    if (this.pendingRemoteManifest <= 0) return
    if (!force && this.pendingRemoteManifest < REMOTE_MANIFEST_CHECKPOINT_BATCH_SIZE) return
    await ensureLocalFlushed()
    await uploadRemote()
    this.pendingRemoteManifest = 0
  }

  async flushSessionIfNeeded(
    force: boolean,
    writeSession: (state: SessionTouchState) => Promise<void>
  ): Promise<void> {
    const state = this.pendingSession
    if (!state) return
    if (!this.sessionFlush.shouldFlush(force, SESSION_FLUSH_EVERY_N, SESSION_FLUSH_INTERVAL_MS)) {
      return
    }
    await writeSession(state)
    this.sessionFlush.markFlushed()
  }

  async finalizeAll(
    saveLocal: (manifest: SyncManifest) => Promise<void>,
    saveSnapshot: (manifest: SyncManifest) => Promise<void>,
    uploadRemote: () => Promise<void>,
    writeSession: (state: SessionTouchState) => Promise<void>
  ): Promise<void> {
    const ensureLocalFlushed = () => this.flushLocalIfNeeded(true, saveLocal, saveSnapshot)
    await ensureLocalFlushed()
    await this.flushRemoteIfNeeded(true, uploadRemote, ensureLocalFlushed)
    await this.flushSessionIfNeeded(true, writeSession)
  }
}
