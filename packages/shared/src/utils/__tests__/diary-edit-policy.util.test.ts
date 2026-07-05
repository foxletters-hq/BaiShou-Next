import { describe, expect, it } from 'vitest'
import { isDiaryEditOverwriteMode, resolveDiaryEditMode } from '../diary-edit-policy.util'

describe('diary-edit-policy.util', () => {
  it('detects overwrite mode', () => {
    expect(isDiaryEditOverwriteMode('overwrite')).toBe(true)
    expect(isDiaryEditOverwriteMode('append')).toBe(false)
    expect(isDiaryEditOverwriteMode(undefined)).toBe(false)
  })

  it('resolves edit mode', () => {
    expect(resolveDiaryEditMode()).toBe('append')
    expect(resolveDiaryEditMode('append')).toBe('append')
    expect(resolveDiaryEditMode('overwrite')).toBe('overwrite')
  })
})
