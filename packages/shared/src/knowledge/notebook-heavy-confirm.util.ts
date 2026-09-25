export const NOTEBOOK_HEAVY_CONFIRM_WAIT_MS = 3000

export function notebookHeavyConfirmSecondsLeft(
  startedAt: number,
  now: number,
  waitMs = NOTEBOOK_HEAVY_CONFIRM_WAIT_MS
): number {
  return Math.max(0, Math.ceil((startedAt + waitMs - now) / 1000))
}

export function isNotebookHeavyConfirmReady(
  startedAt: number,
  now: number,
  waitMs = NOTEBOOK_HEAVY_CONFIRM_WAIT_MS
): boolean {
  return now >= startedAt + waitMs
}
