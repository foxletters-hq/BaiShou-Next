export const SYNC_CONFIRM_DELAY_MS = 2000

export class SyncConfirmNotReadyError extends Error {
  constructor(public readonly remainingMs: number) {
    super(`SyncConfirmNotReadyError: confirm available in ${remainingMs}ms`)
    this.name = 'SyncConfirmNotReadyError'
  }
}

export function computeSyncConfirmSecondsLeft(
  elapsedMs: number,
  delayMs: number = SYNC_CONFIRM_DELAY_MS
): number {
  return Math.max(0, Math.ceil((delayMs - elapsedMs) / 1000))
}

export function isSyncConfirmReady(
  elapsedMs: number,
  delayMs: number = SYNC_CONFIRM_DELAY_MS
): boolean {
  return elapsedMs >= delayMs
}

export function getSyncConfirmEligibleAt(
  startedAtMs: number,
  delayMs: number = SYNC_CONFIRM_DELAY_MS
): number {
  return startedAtMs + delayMs
}

export function assertSyncConfirmReady(eligibleAtMs: number, nowMs: number = Date.now()): void {
  const remainingMs = eligibleAtMs - nowMs
  if (remainingMs > 0) {
    throw new SyncConfirmNotReadyError(remainingMs)
  }
}

export function resolvePlanConfirmEligibleAt(
  preview: { changeCount: number; deletePropagationBlocked: boolean },
  startedAtMs: number = Date.now(),
  delayMs: number = SYNC_CONFIRM_DELAY_MS
): number {
  const canExecuteSync = preview.changeCount > 0 && !preview.deletePropagationBlocked
  return canExecuteSync ? getSyncConfirmEligibleAt(startedAtMs, delayMs) : startedAtMs
}

export function canExecuteIncrementalSyncPlan(preview: {
  changeCount: number
  deletePropagationBlocked: boolean
}): boolean {
  return preview.changeCount > 0 && !preview.deletePropagationBlocked
}

/** 可执行同步时必须已过倒计时；eligibleAt 缺失时 fail closed */
export function assertSyncConfirmAllowed(options: {
  canExecuteSync: boolean
  eligibleAtMs: number | null
  nowMs?: number
}): void {
  if (!options.canExecuteSync) return
  if (options.eligibleAtMs == null) {
    throw new SyncConfirmNotReadyError(SYNC_CONFIRM_DELAY_MS)
  }
  assertSyncConfirmReady(options.eligibleAtMs, options.nowMs)
}
