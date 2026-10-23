import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  MobileRagAbortError,
  MobileRagOperationControl,
  abortableMobileRagDelay,
  assertMobileRagCanContinue,
  mobileRagOperationControl
} from '../mobile-rag-operation-control'

afterEach(() => {
  mobileRagOperationControl.reset()
})

describe('abortableMobileRagDelay', () => {
  it('throws when abort is requested during wait', async () => {
    vi.useFakeTimers()
    const control = new MobileRagOperationControl()
    const promise = abortableMobileRagDelay(2000, control)
    const result = expect(promise).rejects.toBeInstanceOf(MobileRagAbortError)

    control.requestAbort()
    await vi.advanceTimersByTimeAsync(150)
    await result
    vi.useRealTimers()
  })
})

describe('MobileRagAbortError', () => {
  it('carries embedded count', () => {
    expect(new MobileRagAbortError(7).embeddedCount).toBe(7)
  })
})

describe('mobile batch embed pause', () => {
  it('should hold continue until resume when paused', async () => {
    mobileRagOperationControl.reset()
    mobileRagOperationControl.begin()
    mobileRagOperationControl.requestPause()
    expect(mobileRagOperationControl.isPaused).toBe(true)

    let released = false
    const pending = assertMobileRagCanContinue().then(() => {
      released = true
    })
    await Promise.resolve()
    expect(released).toBe(false)

    mobileRagOperationControl.requestResume()
    await pending
    expect(released).toBe(true)
    expect(mobileRagOperationControl.isPaused).toBe(false)
  })

  it('should throw abort error when cancelled while paused', async () => {
    mobileRagOperationControl.reset()
    mobileRagOperationControl.begin()
    mobileRagOperationControl.requestPause()
    const pending = assertMobileRagCanContinue()
    mobileRagOperationControl.requestAbort()
    await expect(pending).rejects.toBeInstanceOf(MobileRagAbortError)
  })
})
