import { describe, it, expect, vi } from 'vitest'
import {
  MigrationControl,
  MigrationAbortError,
  abortableDelay
} from '../migration-control'

describe('abortableDelay', () => {
  it('throws MigrationAbortError when abort is requested during wait', async () => {
    vi.useFakeTimers()
    const control = new MigrationControl()
    const promise = abortableDelay(2000, control)
    const result = expect(promise).rejects.toBeInstanceOf(MigrationAbortError)

    control.requestAbort()
    await vi.advanceTimersByTimeAsync(150)
    await result
    vi.useRealTimers()
  })

  it('resolves when delay completes without abort', async () => {
    vi.useFakeTimers()
    const control = new MigrationControl()
    const promise = abortableDelay(300, control)

    await vi.advanceTimersByTimeAsync(300)
    await expect(promise).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
