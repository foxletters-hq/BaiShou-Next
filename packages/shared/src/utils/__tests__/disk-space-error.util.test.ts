import { describe, expect, it } from 'vitest'
import { isDiskFullError } from '../disk-space-error.util'

describe('isDiskFullError', () => {
  it('detects ENOSPC errors', () => {
    expect(isDiskFullError('ENOSPC: no space left on device, write')).toBe(true)
    expect(isDiskFullError('fatal: unable to write loose object file: No space left on device')).toBe(
      true
    )
  })

  it('ignores unrelated errors', () => {
    expect(isDiskFullError('ECONNREFUSED')).toBe(false)
    expect(isDiskFullError('Access denied')).toBe(false)
  })
})
