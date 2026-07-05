import { describe, it, expect, vi } from 'vitest'
import {
  MobileRagAbortError,
  MobileRagOperationControl,
  abortableMobileRagDelay
} from '../mobile-rag-operation-control'

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
