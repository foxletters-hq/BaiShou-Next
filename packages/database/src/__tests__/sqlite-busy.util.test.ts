import { describe, expect, it } from 'vitest'
import { isSqliteDatabaseLockedError, runWithSqliteBusyRetry } from '../sqlite-busy.util'

describe('isSqliteDatabaseLockedError', () => {
  it('detects expo-sqlite locked finalize errors', () => {
    const error = new Error(
      "Call to function 'NativeStatement.finalizeAsync' has been rejected.\n→ Caused by: Error code : database is locked"
    )
    expect(isSqliteDatabaseLockedError(error)).toBe(true)
  })

  it('ignores corruption errors', () => {
    expect(isSqliteDatabaseLockedError(new Error('database disk image is malformed'))).toBe(false)
  })
})

describe('runWithSqliteBusyRetry', () => {
  it('retries locked errors then succeeds', async () => {
    let attempts = 0
    const result = await runWithSqliteBusyRetry(
      async () => {
        attempts += 1
        if (attempts < 3) {
          throw new Error('database is locked')
        }
        return 'ok'
      },
      { attempts: 5, baseDelayMs: 1 }
    )

    expect(result).toBe('ok')
    expect(attempts).toBe(3)
  })
})
