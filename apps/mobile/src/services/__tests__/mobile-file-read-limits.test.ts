import { describe, expect, it } from 'vitest'
import {
  MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES,
  exceedsMobileExternalTextReadLimit,
  formatOversizedFileError,
  isOversizedReadFailure,
  normalizeExternalFileByteSize
} from '../mobile-file-read-limits'

describe('mobile-file-read-limits', () => {
  it('uses 160MB text read cap', () => {
    expect(MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES).toBe(160 * 1024 * 1024)
  })

  it('formats EFBIG error with size details', () => {
    const err = formatOversizedFileError('/tmp/huge.json', 268501000)
    expect(err.code).toBe('EFBIG')
    expect(err.message).toContain('268501000')
    expect(err.message).toContain('/tmp/huge.json')
  })

  it('normalizes numeric and string byte sizes', () => {
    expect(normalizeExternalFileByteSize(1024)).toBe(1024)
    expect(normalizeExternalFileByteSize('268501000')).toBe(268501000)
    expect(normalizeExternalFileByteSize(undefined)).toBeUndefined()
  })

  it('detects oversized limits and read failures', () => {
    expect(exceedsMobileExternalTextReadLimit(MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES)).toBe(false)
    expect(exceedsMobileExternalTextReadLimit(MOBILE_EXTERNAL_TEXT_READ_MAX_BYTES + 1)).toBe(true)
    expect(exceedsMobileExternalTextReadLimit(undefined)).toBe(false)
    expect(
      isOversizedReadFailure(
        new Error('Failed to allocate a 268501000 byte allocation with 100663296 free bytes')
      )
    ).toBe(true)
    expect(isOversizedReadFailure(formatOversizedFileError('/tmp/huge.json', 268501000))).toBe(true)
    expect(
      isOversizedReadFailure(
        new Error(
          'File too large to read into memory (268501000 bytes, limit 167772160): /tmp/huge.json'
        )
      )
    ).toBe(true)
  })
})
