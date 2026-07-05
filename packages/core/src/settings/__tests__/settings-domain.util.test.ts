import { describe, expect, it } from 'vitest'
import { shouldApplyDiskSettingsKey } from '../settings-domain.util'

describe('shouldApplyDiskSettingsKey', () => {
  it('applies disk when sqlite has no entry', () => {
    expect(shouldApplyDiskSettingsKey(1000, null)).toBe(true)
  })

  it('applies disk when disk file is newer than sqlite', () => {
    const sqliteUpdatedAt = new Date('2026-06-16T10:00:00.000Z')
    expect(shouldApplyDiskSettingsKey(sqliteUpdatedAt.getTime() + 1000, sqliteUpdatedAt)).toBe(true)
  })

  it('skips disk when sqlite is newer than disk file', () => {
    const sqliteUpdatedAt = new Date('2026-06-16T12:00:00.000Z')
    expect(shouldApplyDiskSettingsKey(sqliteUpdatedAt.getTime() - 1000, sqliteUpdatedAt)).toBe(
      false
    )
  })
})
