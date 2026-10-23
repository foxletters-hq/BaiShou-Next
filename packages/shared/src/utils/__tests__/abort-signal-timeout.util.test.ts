import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAbortTimeoutSignal } from '../abort-signal-timeout.util'

const originalTimeout = AbortSignal.timeout

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    writable: true,
    value: originalTimeout
  })
})

describe('createAbortTimeoutSignal', () => {
  it('should use AbortSignal.timeout when it is a function', () => {
    const spy = vi.spyOn(AbortSignal, 'timeout')
    createAbortTimeoutSignal(5_000)
    expect(spy).toHaveBeenCalledWith(5_000)
    spy.mockRestore()
  })

  it('should fall back to AbortController when timeout is not a function', () => {
    Object.defineProperty(AbortSignal, 'timeout', {
      configurable: true,
      writable: true,
      value: undefined
    })
    vi.useFakeTimers()
    const signal = createAbortTimeoutSignal(1_000)
    expect(signal.aborted).toBe(false)
    vi.advanceTimersByTime(1_000)
    expect(signal.aborted).toBe(true)
  })
})
