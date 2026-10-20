import { describe, expect, it } from 'vitest'
import { normalizeSharedMemoryCopyPrefix } from '../shared-memory-copy-prefix.util'

describe('normalizeSharedMemoryCopyPrefix', () => {
  it('treats the legacy demo wording as unset so the localized default applies', () => {
    expect(normalizeSharedMemoryCopyPrefix('Hi, 这是我的回忆...')).toBe('')
    expect(normalizeSharedMemoryCopyPrefix('Hi，这是我的回忆...')).toBe('')
    expect(normalizeSharedMemoryCopyPrefix('Hi, these are my memories...')).toBe('')
  })

  it('keeps a real user prefix trimmed', () => {
    expect(normalizeSharedMemoryCopyPrefix('  这是我们的回忆  ')).toBe('这是我们的回忆')
  })

  it('returns an empty string for missing values', () => {
    expect(normalizeSharedMemoryCopyPrefix(null)).toBe('')
    expect(normalizeSharedMemoryCopyPrefix(undefined)).toBe('')
    expect(normalizeSharedMemoryCopyPrefix('   ')).toBe('')
  })
})
