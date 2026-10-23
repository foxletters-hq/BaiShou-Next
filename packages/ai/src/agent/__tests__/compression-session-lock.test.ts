import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearCompressionSessionLock,
  resetCompressionSessionLockForTests,
  runCompressionWithSessionLock
} from '../compression-session-lock'

describe('compression session lock', () => {
  beforeEach(() => {
    resetCompressionSessionLockForTests()
  })

  it('should start a new job after the previous in-flight lock is cleared', async () => {
    void runCompressionWithSessionLock('s1', () => new Promise(() => undefined))
    clearCompressionSessionLock('s1')

    let started = false
    const result = await runCompressionWithSessionLock('s1', async () => {
      started = true
      return true
    })

    expect(started).toBe(true)
    expect(result).toBe(true)
  })

  it('should not drop a newer job when an older superseded compression finishes', async () => {
    let resolveFirst!: (value: boolean) => void
    const first = runCompressionWithSessionLock(
      's1',
      () =>
        new Promise<boolean>((resolve) => {
          resolveFirst = resolve
        })
    )
    clearCompressionSessionLock('s1')

    let resolveSecond!: (value: boolean) => void
    const second = runCompressionWithSessionLock(
      's1',
      () =>
        new Promise<boolean>((resolve) => {
          resolveSecond = resolve
        })
    )

    resolveFirst(true)
    await first

    let thirdStarted = false
    const third = runCompressionWithSessionLock('s1', async () => {
      thirdStarted = true
      return true
    })
    await Promise.resolve()
    expect(thirdStarted).toBe(false)

    resolveSecond(true)
    await expect(second).resolves.toBe(true)
    await expect(third).resolves.toBe(true)
    expect(thirdStarted).toBe(false)
  })
})
