import { describe, expect, it, vi } from 'vitest'
import { waitForStreamIdleThenForceClear } from '../wait-for-stream-idle.util'

describe('waitForStreamIdleThenForceClear', () => {
  it('returns without force clear when stream becomes idle', async () => {
    let streaming = true
    const forceClear = vi.fn()
    const sleep = vi.fn(async () => {
      streaming = false
    })

    const result = await waitForStreamIdleThenForceClear({
      sessionId: 's1',
      isStreaming: () => streaming,
      forceClear,
      sleep,
      pollMs: 1,
      maxWaitMs: 100
    })

    expect(result.forcedClear).toBe(false)
    expect(forceClear).not.toHaveBeenCalled()
    expect(sleep).toHaveBeenCalled()
  })

  it('force-clears sticky streaming marker after timeout', async () => {
    const forceClear = vi.fn()
    const onForceClear = vi.fn()
    const sleep = vi.fn(async () => undefined)

    const result = await waitForStreamIdleThenForceClear({
      sessionId: 's1',
      isStreaming: () => true,
      forceClear,
      sleep,
      pollMs: 5,
      maxWaitMs: 20,
      onForceClear
    })

    expect(result.forcedClear).toBe(true)
    expect(forceClear).toHaveBeenCalledWith('s1')
    expect(onForceClear).toHaveBeenCalledWith('s1')
    expect(result.waitedMs).toBeGreaterThanOrEqual(20)
  })
})
