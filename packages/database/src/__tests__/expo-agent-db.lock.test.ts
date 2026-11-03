import { describe, it, expect, vi } from 'vitest'
import {
  withExpoAgentDatabaseLock,
  withExpoAgentRawSqliteLock,
  waitForExpoAgentDatabaseIdle
} from '../expo-agent-db.lock'

describe('expo-agent-db.lock', () => {
  it('should not break lock chain when previous task rejects during concurrent queueing', async () => {
    const mockDb = { session: { client: { prepareSync: vi.fn() } } }
    let secondTaskExecuted = false

    // Task 1: Rejects after a delay
    const task1 = withExpoAgentDatabaseLock(mockDb, async () => {
      await new Promise((r) => setTimeout(r, 10))
      throw new Error('Concurrent Task 1 failed intentionally')
    })

    // Task 2: Queued while Task 1 is still in-flight
    const task2 = withExpoAgentDatabaseLock(mockDb, async () => {
      secondTaskExecuted = true
      return 'concurrent success'
    })

    await expect(task1).rejects.toThrow('Concurrent Task 1 failed intentionally')
    const result = await task2
    expect(secondTaskExecuted).toBe(true)
    expect(result).toBe('concurrent success')
  })

  it('should not break raw sqlite lock chain when previous task rejects', async () => {
    let secondTaskExecuted = false

    const task1 = withExpoAgentRawSqliteLock(async () => {
      throw new Error('Raw task 1 failed intentionally')
    })
    await expect(task1).rejects.toThrow('Raw task 1 failed intentionally')

    const task2 = withExpoAgentRawSqliteLock(async () => {
      secondTaskExecuted = true
      return 'raw success'
    })

    const result = await task2
    expect(secondTaskExecuted).toBe(true)
    expect(result).toBe('raw success')
  })

  it('should serialize concurrent async executions in FIFO order', async () => {
    const mockDb = { session: { client: { prepareSync: vi.fn() } } }
    const order: number[] = []

    const p1 = withExpoAgentDatabaseLock(mockDb, async () => {
      await new Promise((r) => setTimeout(r, 20))
      order.push(1)
    })
    const p2 = withExpoAgentDatabaseLock(mockDb, async () => {
      order.push(2)
    })

    await Promise.all([p1, p2])
    expect(order).toEqual([1, 2])
  })

  it('waitForExpoAgentDatabaseIdle waits for pending tasks to settle', async () => {
    const mockDb = { session: { client: { prepareSync: vi.fn() } } }
    let finished = false

    void withExpoAgentDatabaseLock(mockDb, async () => {
      await new Promise((r) => setTimeout(r, 10))
      finished = true
    })

    await waitForExpoAgentDatabaseIdle()
    expect(finished).toBe(true)
  })
})
