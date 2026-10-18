import { afterEach, describe, expect, it, vi } from 'vitest'
import { runAfterIdle, waitForIdle } from '../schedule-idle.util'

type IdleDeadline = {
  didTimeout: boolean
  timeRemaining: () => number
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('runAfterIdle', () => {
  it('should schedule with requestIdleCallback when it is a function', () => {
    const requestIdleCallback = vi.fn(
      (cb: (deadline: IdleDeadline) => void, _options?: { timeout?: number }) => {
        cb({ didTimeout: false, timeRemaining: () => 16 })
        return 7
      }
    )
    const cancelIdleCallback = vi.fn()
    vi.stubGlobal('requestIdleCallback', requestIdleCallback)
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback)

    const task = vi.fn()
    const handle = runAfterIdle(task, { timeout: 500 })

    expect(requestIdleCallback).toHaveBeenCalledTimes(1)
    expect(requestIdleCallback.mock.calls[0]?.[1]).toEqual({ timeout: 500 })
    expect(task).toHaveBeenCalledTimes(1)

    handle.cancel()
    expect(cancelIdleCallback).toHaveBeenCalledWith(7)
  })

  it('should fall back to setTimeout when requestIdleCallback is missing', () => {
    vi.stubGlobal('requestIdleCallback', undefined)
    vi.useFakeTimers()
    const task = vi.fn()
    runAfterIdle(task)
    expect(task).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0)
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('should cancel the timeout fallback before the task runs', () => {
    vi.stubGlobal('requestIdleCallback', undefined)
    vi.useFakeTimers()
    const task = vi.fn()
    const handle = runAfterIdle(task)
    handle.cancel()
    vi.advanceTimersByTime(0)
    expect(task).not.toHaveBeenCalled()
  })

  it('should skip the task when requestIdleCallback still fires after cancel', () => {
    let scheduled: ((deadline: IdleDeadline) => void) | undefined
    const requestIdleCallback = vi.fn((cb: (deadline: IdleDeadline) => void) => {
      scheduled = cb
      return 3
    })
    const cancelIdleCallback = vi.fn()
    vi.stubGlobal('requestIdleCallback', requestIdleCallback)
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback)

    const task = vi.fn()
    const handle = runAfterIdle(task)
    handle.cancel()
    scheduled?.({ didTimeout: false, timeRemaining: () => 16 })

    expect(cancelIdleCallback).toHaveBeenCalledWith(3)
    expect(task).not.toHaveBeenCalled()
  })
})

describe('waitForIdle', () => {
  it('should resolve after the idle callback runs', async () => {
    const requestIdleCallback = vi.fn((cb: (deadline: IdleDeadline) => void) => {
      cb({ didTimeout: false, timeRemaining: () => 16 })
      return 1
    })
    vi.stubGlobal('requestIdleCallback', requestIdleCallback)
    await waitForIdle()
    expect(requestIdleCallback).toHaveBeenCalledTimes(1)
  })
})
