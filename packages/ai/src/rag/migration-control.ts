/** Shared abort flag for in-flight embedding migrations (main process singleton). */
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
