import { describe, expect, it, vi } from 'vitest'
import {
  SyncIpcStallError,
  SyncIpcTimeoutError,
  SYNC_IPC_FAST_TIMEOUT_MS,
  SYNC_IPC_MAX_RETRIES,
  SYNC_IPC_PLAN_TIMEOUT_MS,
  SYNC_IPC_PROGRESS_STALL_MS,
  withSyncIpcTimeoutAndRetry,
  withSyncProgressStallAndRetry
} from '../sync-ipc-timeout'

describe('withSyncIpcTimeoutAndRetry', () => {
  it('returns result when call completes before timeout', async () => {
    await expect(
      withSyncIpcTimeoutAndRetry(async () => 'ok', { timeoutMs: 50, maxRetries: 0 })
    ).resolves.toBe('ok')
  })

  it('retries on timeout and succeeds on later attempt', async () => {
    vi.useFakeTimers()
    let attempts = 0
    const onRetry = vi.fn()

    const promise = withSyncIpcTimeoutAndRetry(
      async () => {
        attempts += 1
        if (attempts < 2) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return 'late'
        }
        return 'ok'
      },
      { timeoutMs: 50, maxRetries: 2, onRetry }
    )

    await vi.advanceTimersByTimeAsync(50)
    await vi.advanceTimersByTimeAsync(100)
    await expect(promise).resolves.toBe('ok')
    expect(onRetry).toHaveBeenCalledWith(1, 2)

    vi.useRealTimers()
  })

  it('throws SyncIpcTimeoutError after max retries', async () => {
    await expect(
      withSyncIpcTimeoutAndRetry(
        () => new Promise<string>(() => undefined),
        { timeoutMs: 20, maxRetries: 1 }
      )
    ).rejects.toBeInstanceOf(SyncIpcTimeoutError)
  })
})

describe('withSyncProgressStallAndRetry', () => {
  it('throws SyncIpcStallError when progress stalls', async () => {
    await expect(
      withSyncProgressStallAndRetry(
        () => new Promise<string>(() => undefined),
        () => () => undefined,
        { stallMs: 50, maxRetries: 0 }
      )
    ).rejects.toBeInstanceOf(SyncIpcStallError)
  })

  it('resets stall timer when progress beats arrive', async () => {
    await expect(
      withSyncProgressStallAndRetry(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 120))
          return 'ok'
        },
        (onBeat) => {
          const interval = setInterval(onBeat, 30)
          return () => clearInterval(interval)
        },
        { stallMs: 200, maxRetries: 0 }
      )
    ).resolves.toBe('ok')
  })
})

describe('sync ipc timeout constants', () => {
  it('uses differentiated defaults', () => {
    expect(SYNC_IPC_FAST_TIMEOUT_MS).toBe(10_000)
    expect(SYNC_IPC_PLAN_TIMEOUT_MS).toBe(60_000)
    expect(SYNC_IPC_PROGRESS_STALL_MS).toBe(30_000)
    expect(SYNC_IPC_MAX_RETRIES).toBe(3)
  })
})
