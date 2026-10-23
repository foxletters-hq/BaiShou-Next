import { describe, expect, it } from 'vitest'
import { normalizeQueueSnapshot } from '../graph-extract-queue.api'

describe('normalizeQueueSnapshot', () => {
  it('should keep aligningCount and overallProgress when the snapshot already has them', () => {
    const normalized = normalizeQueueSnapshot({
      items: [
        {
          id: '1',
          filePath: 'a.md',
          progress: 40,
          status: 'running',
          phase: 'model'
        }
      ],
      activeCount: 1,
      pendingCount: 0,
      runningCount: 1,
      aligningCount: 2,
      completedCount: 0,
      errorCount: 0,
      overallProgress: 40,
      alignPoolSize: 8,
      alignPoolCount: 3
    })
    expect(normalized.aligningCount).toBe(2)
    expect(normalized.overallProgress).toBe(40)
    expect(normalized.alignPoolSize).toBe(8)
    expect(normalized.alignPoolCount).toBe(3)
  })

  it('should default missing aligningCount to 0 and recompute overallProgress from items', () => {
    const normalized = normalizeQueueSnapshot({
      items: [
        {
          id: '1',
          filePath: 'a.md',
          progress: 0,
          status: 'completed'
        },
        {
          id: '2',
          filePath: 'b.md',
          progress: 0,
          status: 'pending'
        }
      ],
      activeCount: 0,
      pendingCount: 1,
      runningCount: 0,
      completedCount: 1,
      errorCount: 0
    })
    expect(normalized.aligningCount).toBe(0)
    expect(normalized.overallProgress).toBe(50)
  })
})
