import { describe, expect, it } from 'vitest'
import { EMPTY_PENDING_EMBED_COUNTS } from '@baishou/shared'
import {
  immediateOrganizePendingSnapshot,
  isMemoryOrganizeCancelledError,
  isMemoryOrganizeIdle,
  memoryOrganizePendingArticleCount,
  resolveMemoryOrganizeFabState,
  loadMemoryOrganizePending,
  memoryOrganizeCardKind,
  memoryOrganizePhaseRows,
  memoryOrganizeProgressPercent,
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
    expect(snapshot.total).toBe(4)
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

  it('should keep graph extract on the snapshot and ignore disambiguate leftovers as active work', () => {
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

describe('memoryOrganizeProgressPercent', () => {
  it('should clamp a running ratio to 0-100', () => {
    expect(memoryOrganizeProgressPercent(3, 10)).toBe(30)
    expect(memoryOrganizeProgressPercent(12, 10)).toBe(100)
    expect(memoryOrganizeProgressPercent(1, 0)).toBe(0)
  })
})

describe('isMemoryOrganizeIdle', () => {
  it('should be idle when embed and graph backlogs are both empty', () => {
    expect(isMemoryOrganizeIdle({ pendingEmbedCount: 0, pendingGraphCount: 0 })).toBe(true)
    expect(isMemoryOrganizeIdle({ pendingEmbedCount: 2, pendingGraphCount: 0 })).toBe(false)
    expect(isMemoryOrganizeIdle({ pendingEmbedCount: 0, pendingGraphCount: 3 })).toBe(false)
  })
})

describe('memoryOrganizePendingArticleCount', () => {
  it('should prefer graph extract backlog as diary article count', () => {
    expect(memoryOrganizePendingArticleCount({ pendingEmbedCount: 4, pendingGraphCount: 7 })).toBe(
      7
    )
    expect(memoryOrganizePendingArticleCount({ pendingEmbedCount: 4, pendingGraphCount: 0 })).toBe(
      4
    )
    expect(memoryOrganizePendingArticleCount({ pendingEmbedCount: 0, pendingGraphCount: 0 })).toBe(
      0
    )
  })

  it('should ignore leftover graph-node embeds when counting 篇 after extract is done', () => {
    expect(
      memoryOrganizePendingArticleCount({
        pendingEmbedCount: 18,
        pendingDiaryCount: 0,
        pendingGraphCount: 0
      })
    ).toBe(0)
    expect(
      memoryOrganizePendingArticleCount({
        pendingEmbedCount: 18,
        pendingDiaryCount: 3,
        pendingGraphCount: 0
      })
    ).toBe(3)
  })
})

describe('immediateOrganizePendingSnapshot', () => {
  it('should keep a cached snapshot only when it still has pending articles', () => {
    expect(
      immediateOrganizePendingSnapshot({
        total: 0,
        graphExtract: 4
      })
    ).toEqual({ total: 0, graphExtract: 4 })
    expect(
      immediateOrganizePendingSnapshot({
        total: 3,
        graphExtract: 0
      })
    ).toEqual({ total: 3, graphExtract: 0 })
    expect(
      immediateOrganizePendingSnapshot({
        total: 18,
        diaries: 0,
        graphExtract: 0
      })
    ).toBeNull()
  })

  it('should ignore a cached empty snapshot so the fab stays loading', () => {
    expect(immediateOrganizePendingSnapshot(null)).toBeNull()
    expect(
      immediateOrganizePendingSnapshot({
        total: 0,
        graphExtract: 0
      })
    ).toBeNull()
  })
})

describe('memoryOrganizeCardKind', () => {
  it('should hide the card when nothing is running and the snapshot has no leftover work', () => {
    expect(memoryOrganizeCardKind({ running: false, pendingCount: 0 })).toBe('hidden')
  })

  it('should show running while batch embed is in flight', () => {
    expect(memoryOrganizeCardKind({ running: true, pendingCount: 4 })).toBe('running')
  })

  it('should hide the card when pending work exists but organize was not interrupted mid-way', () => {
    expect(memoryOrganizeCardKind({ running: false, pendingCount: 4, interrupted: false })).toBe(
      'hidden'
    )
    expect(memoryOrganizeCardKind({ running: false, pendingCount: 4 })).toBe('hidden')
  })

  it('should show incomplete only when organize was interrupted mid-way and pending work remains', () => {
    expect(memoryOrganizeCardKind({ running: false, pendingCount: 4, interrupted: true })).toBe(
      'incomplete'
    )
    expect(memoryOrganizeCardKind({ running: false, pendingCount: 0, hasError: true })).toBe(
      'incomplete'
    )
  })
})

describe('resolveMemoryOrganizeFabState', () => {
  it('should stay loading until the pending snapshot is ready', () => {
    expect(
      resolveMemoryOrganizeFabState({
        snapshotReady: false,
        pendingEmbedCount: 0,
        pendingGraphCount: 0
      })
    ).toEqual({ kind: 'loading', pendingCount: 0 })
  })

  it('should show idle only after a ready empty snapshot', () => {
    expect(
      resolveMemoryOrganizeFabState({
        snapshotReady: true,
        pendingEmbedCount: 0,
        pendingGraphCount: 0
      })
    ).toEqual({ kind: 'idle', pendingCount: 0 })
  })

  it('should show pending count after a ready snapshot with graph backlog', () => {
    expect(
      resolveMemoryOrganizeFabState({
        snapshotReady: true,
        pendingEmbedCount: 2,
        pendingGraphCount: 9
      })
    ).toEqual({ kind: 'pending', pendingCount: 9 })
  })

  it('should not show idle when there are pending memory shards or graph nodes without diaries', () => {
    expect(
      resolveMemoryOrganizeFabState({
        snapshotReady: true,
        pendingEmbedCount: 3,
        pendingGraphCount: 0,
        pendingDiaryCount: 0
      })
    ).toEqual({ kind: 'pending', pendingCount: 0 })
  })
})

describe('isMemoryOrganizeCancelledError', () => {
  it('should treat MobileRagAbortError as a cancelled organize', () => {
    expect(isMemoryOrganizeCancelledError({ name: 'MobileRagAbortError' })).toBe(true)
    expect(isMemoryOrganizeCancelledError(new Error('boom'))).toBe(false)
  })
})

describe('memoryOrganizePhaseRows', () => {
  it('should list diary memory graph extract and graph node rows like desktop', () => {
    const rows = memoryOrganizePhaseRows({
      phase: 'memory',
      phases: {
        diaries: { completed: 2, total: 2 },
        memories: { completed: 1, total: 4 },
        graphNodes: { completed: 0, total: 3 },
        knowledgeSources: { completed: 0, total: 0 },
        graphExtract: { completed: 0, total: 5 },
        graphDisambiguate: { completed: 0, total: 0 }
      }
    })
    expect(rows.map((row) => row.id)).toEqual(['diary', 'memory', 'graph_extract', 'graph_node'])
    expect(rows[0]).toMatchObject({ id: 'diary', status: 'done', barPercent: 100 })
    expect(rows[1]).toMatchObject({ id: 'memory', status: 'running', completed: 1, total: 4 })
    expect(rows[2]?.status).toBe('pending')
    expect(rows[3]?.status).toBe('pending')
  })
})
