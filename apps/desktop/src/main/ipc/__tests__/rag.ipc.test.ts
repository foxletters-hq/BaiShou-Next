import { describe, it, expect } from 'vitest'
import { filterUnindexedDiaries } from '../rag.ipc'

describe('filterUnindexedDiaries', () => {
  it('should filter out diaries that are already indexed and not modified', () => {
    const diaries = [
      { id: 1, content: 'diary 1', updatedAt: new Date('2026-05-20T00:00:00Z') },
      { id: 2, content: 'diary 2', updatedAt: new Date('2026-05-20T00:00:00Z') },
      { id: 3, content: 'diary 3', updatedAt: new Date('2026-05-20T00:00:00Z') }
    ]
    const embeddedIds = new Set(['1', '2', '3'])
    const embeddedUpdatedAtMap = new Map<string, number>([
      ['1', new Date('2026-05-20T00:00:00Z').getTime()],
      ['2', new Date('2026-05-20T00:00:00Z').getTime()],
      ['3', new Date('2026-05-20T00:00:00Z').getTime()]
    ])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

    expect(result).toHaveLength(0)
  })

  it('should include diaries that have never been indexed', () => {
    const diaries = [
      { id: 1, content: 'diary 1', updatedAt: new Date('2026-05-20T00:00:00Z') },
      { id: 2, content: 'diary 2', updatedAt: new Date('2026-05-20T00:00:00Z') }
    ]
    const embeddedIds = new Set(['1'])
    const embeddedUpdatedAtMap = new Map<string, number>([
      ['1', new Date('2026-05-20T00:00:00Z').getTime()]
    ])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(2)
  })

  it('should include diaries that have been modified after indexing', () => {
    const diaries = [
      { id: 1, content: 'diary 1 modified', updatedAt: new Date('2026-05-21T00:00:00Z') },
      { id: 2, content: 'diary 2', updatedAt: new Date('2026-05-20T00:00:00Z') }
    ]
    const embeddedIds = new Set(['1', '2'])
    const embeddedUpdatedAtMap = new Map<string, number>([
      ['1', new Date('2026-05-20T00:00:00Z').getTime()],
      ['2', new Date('2026-05-20T00:00:00Z').getTime()]
    ])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(1)
  })

  it('should filter out diaries that are indexed but lack metadata updated_at', () => {
    const diaries = [
      { id: 1, content: 'diary 1', updatedAt: new Date('2026-05-20T00:00:00Z') },
      { id: 2, content: 'diary 2', updatedAt: new Date('2026-05-20T00:00:00Z') }
    ]
    // 向量库里有记录，但没有元数据更新时间 (例如没有出现在 embeddedUpdatedAtMap 中，或者 map 中无此项)
    const embeddedIds = new Set(['1', '2'])
    const embeddedUpdatedAtMap = new Map<string, number>()

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

    expect(result).toHaveLength(0)
  })
})
