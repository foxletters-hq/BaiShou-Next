import { describe, expect, it } from 'vitest'
import { EMPTY_PENDING_EMBED_COUNTS, type RagConfig } from '@baishou/shared'
import {
  diaryPendingStatusFromSnapshot,
  diaryPendingOrganizeCount,
  initialDiaryPendingStatusFromSnapshot,
  loadDiaryPendingStatus,
  resolveDiaryPendingStatusRefresh,
  shouldHydrateDiaryPendingSnapshot,
  type DiaryOrganizePendingSnapshot,
  type DiaryPendingStatusView
} from '../diary-pending-status.util'

const SNAPSHOT: DiaryOrganizePendingSnapshot = {
  ...EMPTY_PENDING_EMBED_COUNTS,
  diaries: 4,
  graphNodes: 1,
  total: 5,
  graphExtract: 2
}

const PREVIOUS: DiaryPendingStatusView = {
  pendingGraphCount: 2,
  pendingEmbedCount: 5,
  pendingEmbedParts: SNAPSHOT,
  graphConfigured: true,
  ragConfigured: true
}

describe('diaryPendingStatusFromSnapshot', () => {
  it('should map organize snapshot counts onto the diary status bar when snapshot exists', () => {
    expect(diaryPendingStatusFromSnapshot(SNAPSHOT, true)).toEqual({
      pendingGraphCount: 2,
      pendingEmbedCount: 5,
      pendingEmbedParts: SNAPSHOT,
      graphConfigured: true,
      ragConfigured: true
    })
  })

  it('should return null when there is no snapshot to restore', () => {
    expect(diaryPendingStatusFromSnapshot(null, true)).toBeNull()
    expect(initialDiaryPendingStatusFromSnapshot(null).pendingEmbedCount).toBe(0)
  })
})

describe('loadDiaryPendingStatus', () => {
  it('should keep fallback embed counts when the live snapshot loader throws', async () => {
    const result = await loadDiaryPendingStatus({
      getSnapshot: async () => {
        throw new Error('shadow db not connected')
      },
      getRagConfig: async () => ({ ragEnabled: true }) as unknown as RagConfig,
      getGlobalModels: async () => null,
      fallbackSnapshot: SNAPSHOT
    })
    expect(result.view.pendingEmbedCount).toBe(5)
    expect(result.view.pendingGraphCount).toBe(2)
    expect(result.view.ragConfigured).toBe(true)
  })

  it('should still apply a successful zero snapshot so a finished organize can hide the bar', async () => {
    const result = await loadDiaryPendingStatus({
      getSnapshot: async () => ({
        ...EMPTY_PENDING_EMBED_COUNTS,
        graphExtract: 0
      }),
      getRagConfig: async () => ({ ragEnabled: true }) as unknown as RagConfig,
      getGlobalModels: async () => null,
      fallbackSnapshot: SNAPSHOT
    })
    expect(result.view.pendingEmbedCount).toBe(0)
    expect(result.view.pendingGraphCount).toBe(0)
  })

  it('should keep ragConfigured true when rag_config is missing', async () => {
    const result = await loadDiaryPendingStatus({
      getSnapshot: async () => SNAPSHOT,
      getRagConfig: async () => {
        throw new Error('settings missing')
      },
      getGlobalModels: async () => {
        throw new Error('models missing')
      }
    })
    expect(result.view.ragConfigured).toBe(true)
    expect(result.view.pendingEmbedCount).toBe(5)
  })
})

describe('shouldHydrateDiaryPendingSnapshot', () => {
  it('should skip local snapshot hydrate after a live refresh has already landed', () => {
    expect(
      shouldHydrateDiaryPendingSnapshot({
        liveApplied: true,
        current: { pendingEmbedCount: 0, pendingGraphCount: 0 }
      })
    ).toBe(false)
  })

  it('should hydrate only when the bar is still empty and live refresh has not landed', () => {
    expect(
      shouldHydrateDiaryPendingSnapshot({
        liveApplied: false,
        current: { pendingEmbedCount: 0, pendingGraphCount: 0 }
      })
    ).toBe(true)
    expect(
      shouldHydrateDiaryPendingSnapshot({
        liveApplied: false,
        current: { pendingEmbedCount: 5, pendingGraphCount: 0 }
      })
    ).toBe(false)
  })
})

describe('resolveDiaryPendingStatusRefresh', () => {
  it('should keep the previous bar when a later refresh fails', () => {
    expect(
      resolveDiaryPendingStatusRefresh({
        requestId: 2,
        latestRequestId: 2,
        previous: PREVIOUS,
        next: null,
        failed: true
      })
    ).toEqual(PREVIOUS)
  })

  it('should ignore a stale response after the user switches pages', () => {
    expect(
      resolveDiaryPendingStatusRefresh({
        requestId: 1,
        latestRequestId: 2,
        previous: PREVIOUS,
        next: {
          ...PREVIOUS,
          pendingEmbedCount: 0,
          pendingGraphCount: 0
        },
        failed: false
      })
    ).toBeNull()
  })

  it('should apply a current successful refresh including a real zero', () => {
    const next: DiaryPendingStatusView = {
      ...PREVIOUS,
      pendingEmbedCount: 0,
      pendingGraphCount: 0
    }
    expect(
      resolveDiaryPendingStatusRefresh({
        requestId: 3,
        latestRequestId: 3,
        previous: PREVIOUS,
        next,
        failed: false
      })
    ).toEqual(next)
  })
})

describe('diaryPendingOrganizeCount', () => {
  it('should count unique diary articles instead of summing extract and embed queues', () => {
    expect(
      diaryPendingOrganizeCount({
        graphConfigured: true,
        ragConfigured: true,
        pendingGraphCount: 69,
        pendingEmbedCount: 69,
        pendingDiaryCount: 69
      })
    ).toBe(69)
  })
})
