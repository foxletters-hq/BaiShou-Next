import { describe, expect, it } from 'vitest'
import {
  buildPendingEmbedCounts,
  countPendingFromUnembeddedList,
  createPendingEmbedCountCache
} from '../pending-embed-count.util'

describe('buildPendingEmbedCounts', () => {
  it('should keep notebook leftovers off the memory-system total', () => {
    expect(
      buildPendingEmbedCounts({
        unindexedDiaryCount: 2,
        missingMemoryCount: 3,
        missingGraphNodeCount: 4,
        missingKnowledgeSourceCount: 5,
        missingNotebookGraphNodeCount: 6
      })
    ).toEqual({
      diaries: 2,
      memories: 3,
      graphNodes: 4,
      knowledgeSources: 5,
      notebookGraphNodes: 6,
      total: 9
    })
  })

  it('clamps negatives and non-finite values the same way as nonNegativeCount', () => {
    expect(
      buildPendingEmbedCounts({
        unindexedDiaryCount: -8,
        missingMemoryCount: Number.NaN,
        missingGraphNodeCount: Number.POSITIVE_INFINITY,
        missingKnowledgeSourceCount: -2
      })
    ).toEqual({
      diaries: 0,
      memories: 0,
      graphNodes: 0,
      knowledgeSources: 0,
      notebookGraphNodes: 0,
      total: 0
    })

    expect(
      buildPendingEmbedCounts({
        unindexedDiaryCount: Number.NEGATIVE_INFINITY,
        missingMemoryCount: 1.8,
        missingGraphNodeCount: -0.4
      })
    ).toEqual({
      diaries: 0,
      memories: 1,
      graphNodes: 0,
      knowledgeSources: 0,
      notebookGraphNodes: 0,
      total: 1
    })
  })
})

describe('countPendingFromUnembeddedList', () => {
  it('should count unembedded notebook graph nodes without mixing knowledge sources', async () => {
    await expect(
      countPendingFromUnembeddedList(async () => [
        { id: 'n1', notebookId: 'nb1' },
        { id: 'n2', notebookId: 'nb2' }
      ])
    ).resolves.toBe(2)
  })

  it('should return zero when the list is empty or missing', async () => {
    await expect(countPendingFromUnembeddedList(async () => [])).resolves.toBe(0)
    await expect(countPendingFromUnembeddedList(async () => null)).resolves.toBe(0)
    await expect(countPendingFromUnembeddedList(async () => undefined)).resolves.toBe(0)
  })

  it('should return zero when listing throws', async () => {
    await expect(
      countPendingFromUnembeddedList(async () => {
        throw new Error('db-not-ready')
      })
    ).resolves.toBe(0)
  })
})

describe('createPendingEmbedCountCache', () => {
  it('reuses the first result until invalidate', async () => {
    let calls = 0
    const cache = createPendingEmbedCountCache()
    const loader = async () => {
      calls += 1
      return buildPendingEmbedCounts({
        unindexedDiaryCount: calls,
        missingMemoryCount: 0,
        missingGraphNodeCount: 0
      })
    }

    const first = await cache.get(loader)
    const second = await cache.get(loader)
    expect(first).toEqual(second)
    expect(calls).toBe(1)

    cache.invalidate()
    const third = await cache.get(loader)
    expect(third.diaries).toBe(2)
    expect(calls).toBe(2)
  })

  it('should not write a stale in-flight result after invalidate', async () => {
    const cache = createPendingEmbedCountCache()
    let resolveFirst!: (value: ReturnType<typeof buildPendingEmbedCounts>) => void
    const firstPending = cache.get(
      () =>
        new Promise<ReturnType<typeof buildPendingEmbedCounts>>((resolve) => {
          resolveFirst = resolve
        })
    )
    cache.invalidate()
    const second = cache.get(async () =>
      buildPendingEmbedCounts({
        unindexedDiaryCount: 9,
        missingMemoryCount: 0,
        missingGraphNodeCount: 0
      })
    )
    resolveFirst(
      buildPendingEmbedCounts({
        unindexedDiaryCount: 1,
        missingMemoryCount: 0,
        missingGraphNodeCount: 0
      })
    )
    expect((await second).diaries).toBe(9)
    expect((await firstPending).diaries).toBe(1)
    const third = await cache.get(async () =>
      buildPendingEmbedCounts({
        unindexedDiaryCount: 3,
        missingMemoryCount: 0,
        missingGraphNodeCount: 0
      })
    )
    expect(third.diaries).toBe(9)
  })
})
