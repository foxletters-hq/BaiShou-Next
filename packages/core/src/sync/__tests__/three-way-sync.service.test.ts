import { describe, it, expect } from 'vitest'
import { limitExecute } from '../three-way-sync.service'

describe('limitExecute concurrency controller', () => {
  it('should run all tasks and return ordered results', async () => {
    const items = [1, 2, 3, 4, 5]
    const results = await limitExecute(items, 2, async (x) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return x * 10
    })

    expect(results).toEqual([10, 20, 30, 40, 50])
  })

  it('should not exceed the concurrency limit', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    let activeCount = 0
    let maxActiveCount = 0

    const fn = async (x: number) => {
      activeCount++
      if (activeCount > maxActiveCount) {
        maxActiveCount = activeCount
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
      activeCount--
      return x
    }

    // 限制最大并发数为 3
    await limitExecute(items, 3, fn)

    expect(maxActiveCount).toBeLessThanOrEqual(3)
  })

  it('should handle empty list gracefully', async () => {
    const results = await limitExecute([], 3, async (x) => x)
    expect(results).toEqual([])
  })
})
