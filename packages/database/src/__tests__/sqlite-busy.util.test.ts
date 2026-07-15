import { describe, expect, it } from 'vitest'
import {
  isExpoSqliteNativeUnavailableError,
  isSqliteDatabaseLockedError,
  runWithSqliteBusyRetry
} from '../sqlite-busy.util'

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

describe('isExpoSqliteNativeUnavailableError', () => {
  it('detects NativeDatabase NullPointerException', () => {
    const error = new Error(
      "Call to function 'NativeDatabase.execAsync' has been rejected.\n→ Caused by: java.lang.NullPointerException: java.lang.NullPointerException"
    )
    expect(isExpoSqliteNativeUnavailableError(error)).toBe(true)
  })

  it('detects prepareSync NullPointerException', () => {
    const error = new Error(
      "Call to function 'NativeDatabase.prepareSync' has been rejected.\n→ Caused by: java.lang.NullPointerException"
    )
    expect(isExpoSqliteNativeUnavailableError(error)).toBe(true)
  })

  it('does not treat database locked as unavailable', () => {
    const error = new Error(
      "Call to function 'NativeStatement.finalizeAsync' has been rejected.\n→ Caused by: Error code : database is locked"
    )
    expect(isExpoSqliteNativeUnavailableError(error)).toBe(false)
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

  it('does not retry native unavailable errors', async () => {
    let attempts = 0
    await expect(
      runWithSqliteBusyRetry(
        async () => {
          attempts += 1
          throw new Error(
            "Call to function 'NativeDatabase.execAsync' has been rejected.\n→ Caused by: java.lang.NullPointerException"
          )
        },
        { attempts: 5, baseDelayMs: 1 }
      )
    ).rejects.toThrow(/NullPointerException/)
    expect(attempts).toBe(1)
  })
})
