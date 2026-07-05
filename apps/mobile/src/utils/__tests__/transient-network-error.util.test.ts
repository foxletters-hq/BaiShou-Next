import { describe, expect, it } from 'vitest'
import { isTransientNetworkError, withTransientNetworkRetry } from '../transient-network-error.util'

describe('isTransientNetworkError', () => {
  it('detects common mobile network failures', () => {
    expect(isTransientNetworkError(new Error('Network request failed'))).toBe(true)
    expect(isTransientNetworkError(new Error('fetch failed'))).toBe(true)
    expect(isTransientNetworkError(new Error('Request timed out'))).toBe(true)
  })

  it('ignores non-network errors', () => {
    expect(isTransientNetworkError(new Error('invalid api key'))).toBe(false)
  })
})

describe('withTransientNetworkRetry', () => {
  it('retries transient failures', async () => {
    let attempts = 0
    const result = await withTransientNetworkRetry(
      async () => {
        attempts += 1
        if (attempts < 2) throw new Error('Network request failed')
        return 'ok'
      },
      { retries: 2, baseDelayMs: 1 }
    )
    expect(result).toBe('ok')
    expect(attempts).toBe(2)
  })
})
