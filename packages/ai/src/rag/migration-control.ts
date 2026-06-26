/** Shared abort flag for in-flight embedding migrations (main process singleton). */
export class MigrationAbortError extends Error {
  constructor() {
    super('Migration aborted')
    this.name = 'MigrationAbortError'
  }
}

export class MigrationControl {
  private aborted = false

  reset(): void {
    this.aborted = false
  }

  requestAbort(): void {
    this.aborted = true
  }

  get isAborted(): boolean {
    return this.aborted
  }
}

export const migrationControl = new MigrationControl()

export const MIGRATION_CONSECUTIVE_FAILURE_LIMIT = 3

/** 可被迁移取消打断的 sleep，避免取消后仍卡在重试退避等待 */
export async function abortableDelay(ms: number, control: MigrationControl): Promise<void> {
  if (ms <= 0 || control.isAborted) {
    if (control.isAborted) throw new MigrationAbortError()
    return
  }

  const step = 100
  let elapsed = 0
  while (elapsed < ms) {
    if (control.isAborted) throw new MigrationAbortError()
    const slice = Math.min(step, ms - elapsed)
    await new Promise((resolve) => setTimeout(resolve, slice))
    elapsed += slice
  }
}
