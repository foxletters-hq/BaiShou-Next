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

  it('should preempt queued low-priority tasks with all high-priority tasks in FIFO order', async () => {
    const mockDb = { session: { client: { prepareSync: vi.fn() } } }
    const order: string[] = []
    let releaseLow1!: () => void
    const low1Gate = new Promise<void>((resolve) => {
      releaseLow1 = resolve
    })

    // 低优任务 1 先拿到空闲锁并占用一段时间
    const low1 = withExpoAgentDatabaseLock(
      mockDb,
      async () => {
        order.push('low-1:start')
        await low1Gate
        order.push('low-1:end')
      },
      'low'
    )

    // 在 low-1 持锁期间，同时涌入多个低优与高优任务
    const low2 = withExpoAgentDatabaseLock(
      mockDb,
      async () => {
        order.push('low-2')
      },
      'low'
    )
    const low3 = withExpoAgentDatabaseLock(
      mockDb,
      async () => {
        order.push('low-3')
      },
      'low'
    )
    const high1 = withExpoAgentDatabaseLock(
      mockDb,
      async () => {
        order.push('high-1')
      },
      'high'
    )
    const high2 = withExpoAgentDatabaseLock(
      mockDb,
      async () => {
        order.push('high-2')
      },
      'high'
    )

    releaseLow1()
    await Promise.all([low1, low2, low3, high1, high2])

    // 所有高优任务必须全部优先于后续低优任务执行，同优先级保持 FIFO
    expect(order).toEqual(['low-1:start', 'low-1:end', 'high-1', 'high-2', 'low-2', 'low-3'])
  })

  it('should let newly arrived high-priority task preempt remaining low-priority tasks mid-queue', async () => {
    const mockDb = { session: { client: { prepareSync: vi.fn() } } }
    const order: string[] = []
    let highMid: Promise<void> | undefined

    const low1 = withExpoAgentDatabaseLock(
      mockDb,
      async () => {
        order.push('low-1')
        // 在 low-1 即将释放锁时，后台低优队列已有 low-2/low-3，此时插入高优任务
        highMid = withExpoAgentDatabaseLock(
          mockDb,
          async () => {
            order.push('high-mid')
          },
          'high'
        )
      },
      'low'
    )
    const low2 = withExpoAgentDatabaseLock(
      mockDb,
      async () => {
        order.push('low-2')
      },
      'low'
    )
    const rawHigh = withExpoAgentRawSqliteLock(async () => {
      order.push('raw-high')
    }, 'high')

    await Promise.all([low1, low2, rawHigh])
    await highMid

    expect(order).toEqual(['low-1', 'raw-high', 'high-mid', 'low-2'])
  })

  it('waitForExpoAgentDatabaseIdle should drain both high/low queues including chained tasks', async () => {
    const mockDb = { session: { client: { prepareSync: vi.fn() } } }
    const executed: string[] = []

    const low1 = withExpoAgentDatabaseLock(
      mockDb,
      async () => {
        await new Promise((r) => setTimeout(r, 10))
        executed.push('low-1')
      },
      'low'
    )
    const high1 = withExpoAgentDatabaseLock(
      mockDb,
      async () => {
        await new Promise((r) => setTimeout(r, 5))
        executed.push('high-1')
      },
      'high'
    )
    const low2 = withExpoAgentDatabaseLock(
      mockDb,
      async () => {
        executed.push('low-2')
      },
      'low'
    )

    // 第一波结束后立刻在微任务内补发第二波任务，验证 idle 等待不会提前返回
    const chained = low2.then(() =>
      withExpoAgentDatabaseLock(
        mockDb,
        async () => {
          await new Promise((r) => setTimeout(r, 5))
          executed.push('round-2')
        },
        'low'
      )
    )

    await waitForExpoAgentDatabaseIdle()
    await Promise.all([low1, high1, low2, chained])

    expect(executed).toEqual(['low-1', 'high-1', 'low-2', 'round-2'])
  })
})
