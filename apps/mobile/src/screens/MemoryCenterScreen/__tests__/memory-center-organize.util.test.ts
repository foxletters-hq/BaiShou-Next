import { describe, expect, it } from 'vitest'
import { snapshotMemoryEmbedPhases } from '../memory-center-organize.util'

describe('snapshotMemoryEmbedPhases', () => {
  it('should start from diary when diary backlog exists', () => {
    const snapshot = snapshotMemoryEmbedPhases({
      diaries: 3,
      memories: 1,
      graphNodes: 0,
      knowledgeSources: 2,
      notebookGraphNodes: 0,
      total: 6
    })
    expect(snapshot.phase).toBe('diary')
    expect(snapshot.phases.diaries.total).toBe(3)
    expect(snapshot.total).toBe(6)
  })

  it('should finish when every pending count is zero', () => {
    const snapshot = snapshotMemoryEmbedPhases({
      diaries: 0,
      memories: 0,
      graphNodes: 0,
      knowledgeSources: 0,
      notebookGraphNodes: 0,
      total: 0
    })
    expect(snapshot.phase).toBe('finishing')
    expect(snapshot.total).toBe(1)
  })
})
