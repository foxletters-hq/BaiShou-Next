let shownThisLaunch = false

export function isStartupEmbedReminderEnabled(
  config?: { startupEmbedReminder?: boolean } | null
): boolean {
  return config?.startupEmbedReminder !== false
}

/** 同一次启动只弹一次；total === 0 或用户关闭启动检查时静默。 */
export function shouldShowPendingEmbedReminder(
  total: number,
  options?: { enabled?: boolean }
): boolean {
  if (options?.enabled === false) return false
  if (!Number.isFinite(total) || total <= 0 || shownThisLaunch) return false
  shownThisLaunch = true
  return true
}

export function resetPendingEmbedReminderForTests(): void {
  shownThisLaunch = false
}
