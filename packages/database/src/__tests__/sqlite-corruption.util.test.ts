import { describe, expect, it } from 'vitest'
import { isSqliteDatabaseCorruptionError } from '../sqlite-corruption.util'

describe('isSqliteDatabaseCorruptionError', () => {
  it('detects database disk image is malformed', () => {
    expect(
      isSqliteDatabaseCorruptionError(
        new Error(
          "Call to function 'NativeStatement.runSync' has been rejected.\n→ Caused by: Error code : database disk image is malformed"
        )
      )
    ).toBe(true)
  })

  it('ignores malformed JSON from FTS backfill', () => {
    expect(
      isSqliteDatabaseCorruptionError(
        new Error(
          "Call to function 'NativeStatement.finalizeAsync' has been rejected.\n→ Caused by: Error code : malformed JSON"
        )
      )
    ).toBe(false)
  })

  it('detects SQLITE_CORRUPT code', () => {
    const err = new Error('db broken') as Error & { code: string }
    err.code = 'SQLITE_CORRUPT'
    expect(isSqliteDatabaseCorruptionError(err)).toBe(true)
  })
})
