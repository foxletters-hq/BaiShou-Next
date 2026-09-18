import { describe, expect, it } from 'vitest'
import { GRAPH_EXTRACT_ALIGN_POOL_SIZE } from '../graph-extract-batch.util'
import { emptyGraphExtractQueueSnapshot } from '../graph-extract-queue-engine.types'

describe('emptyGraphExtractQueueSnapshot', () => {
  it('should use the default align pool size when none is passed', () => {
    const snapshot = emptyGraphExtractQueueSnapshot()
    expect(snapshot.alignPoolSize).toBe(GRAPH_EXTRACT_ALIGN_POOL_SIZE)
    expect(snapshot.items).toEqual([])
    expect(snapshot.activeCount).toBe(0)
  })

  it('should keep a custom align pool size when the caller overrides it', () => {
    expect(emptyGraphExtractQueueSnapshot(3).alignPoolSize).toBe(3)
  })
})
