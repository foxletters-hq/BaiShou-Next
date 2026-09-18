import { describe, expect, it } from 'vitest'
import { EMPTY_PENDING_EMBED_COUNTS } from '@baishou/shared'
import {
  loadMemoryOrganizePending,
  snapshotMemoryEmbedPhases
} from '../memory-center-organize.util'

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

  it('should keep graph extract and disambiguate on the snapshot for progress', () => {
    const snapshot = snapshotMemoryEmbedPhases({
      diaries: 0,
      memories: 0,
      graphNodes: 0,
      knowledgeSources: 0,
      notebookGraphNodes: 0,
      total: 0,
      graphExtract: 4,
      graphDisambiguate: 2
    })
    expect(snapshot.phase).toBe('graph_extract')
    expect(snapshot.phases.graphExtract.total).toBe(4)
    expect(snapshot.phases.graphDisambiguate.total).toBe(2)
    expect(snapshot.total).toBe(6)
  })
})

describe('loadMemoryOrganizePending', () => {
  it('should prefer organize snapshot when the rag service exposes it', async () => {
    const snapshot = {
      ...EMPTY_PENDING_EMBED_COUNTS,
      graphExtract: 3,
      graphDisambiguate: 1
    }
    const result = await loadMemoryOrganizePending({
      getOrganizePendingSnapshot: async () => snapshot
    })
    expect(result).toEqual(snapshot)
  })

  it('should fall back to embed counts when organize snapshot is missing', async () => {
    const counts = { ...EMPTY_PENDING_EMBED_COUNTS, diaries: 2, total: 2 }
    const result = await loadMemoryOrganizePending({
      getPendingEmbedCounts: async () => counts
    })
    expect(result).toEqual(counts)
  })
})
