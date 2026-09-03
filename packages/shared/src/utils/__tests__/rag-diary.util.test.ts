import { describe, it, expect } from 'vitest'
import {
  sortDiariesByDateAsc,
  sortDiariesByDateDesc,
  filterUnindexedDiaries,
  buildDiaryEmbeddingSourceId,
  buildDiaryEmbeddingGroupId,
  isLegacyDiaryEmbeddingSourceId,
  buildDiaryEmbeddingDatePrefix,
  buildDiaryEmbeddingTextArgs
} from '../rag-diary.util'

describe('sortDiariesByDateAsc', () => {
  it('sorts diaries oldest first for batch embed without mutating input', () => {
    const diaries = [
      { id: 1, date: new Date('2024-01-01') },
      { id: 2, date: new Date('2026-06-01') },
      { id: 3, date: new Date('2025-03-15') }
    ]

    const sorted = sortDiariesByDateAsc(diaries)

    expect(sorted.map((d) => d.id)).toEqual([1, 3, 2])
    expect(diaries.map((d) => d.id)).toEqual([1, 2, 3])
  })
})

describe('sortDiariesByDateDesc', () => {
  it('sorts diaries newest first for display without mutating input', () => {
    const diaries = [
      { id: 1, date: new Date('2024-01-01') },
      { id: 2, date: new Date('2026-06-01') },
      { id: 3, date: new Date('2025-03-15') }
    ]

    const sorted = sortDiariesByDateDesc(diaries)

    expect(sorted.map((d) => d.id)).toEqual([2, 3, 1])
  })
})

describe('buildDiaryEmbeddingDatePrefix', () => {
  it('formats local calendar date without tag metadata', () => {
    expect(buildDiaryEmbeddingDatePrefix(new Date(2026, 8, 1))).toBe('[2026-09-01 日记:]\n')
    expect(buildDiaryEmbeddingDatePrefix('2026-09-01')).toBe('[2026-09-01 日记:]\n')
    expect(buildDiaryEmbeddingDatePrefix('not-a-date')).toBe('')
  })
})

describe('buildDiaryEmbeddingTextArgs', () => {
  it('uses diary body as text and only adds a date prefix', () => {
    expect(buildDiaryEmbeddingTextArgs('开会纪要 #工作', '2026-09-01')).toEqual({
      text: '开会纪要 #工作',
      chunkPrefix: '[2026-09-01 日记:]\n'
    })
    expect(buildDiaryEmbeddingTextArgs('开会纪要', '2026-09-01').chunkPrefix).not.toContain('标签')
    expect(buildDiaryEmbeddingTextArgs('开会纪要', 'not-a-date')).toEqual({
      text: '开会纪要',
      chunkPrefix: ''
    })
  })
})

describe('diary embedding keys', () => {
  it('builds vault-scoped source and group ids', () => {
    expect(buildDiaryEmbeddingSourceId('vlt_abc', 42)).toBe('vlt_abc#42')
    expect(buildDiaryEmbeddingGroupId('anything')).toBe('diary')
    expect(isLegacyDiaryEmbeddingSourceId('42')).toBe(true)
    expect(isLegacyDiaryEmbeddingSourceId('Personal#42')).toBe(false)
  })
})

describe('filterUnindexedDiaries', () => {
  it('includes diaries that have never been indexed', () => {
    const diaries = [
      { id: 1, updatedAt: new Date('2026-05-20T00:00:00Z') },
      { id: 2, updatedAt: new Date('2026-05-20T00:00:00Z') }
    ]
    const embeddedIds = new Set([buildDiaryEmbeddingSourceId('vlt_abc', 1)])
    const embeddedUpdatedAtMap = new Map<string, number>([
      [buildDiaryEmbeddingSourceId('vlt_abc', 1), new Date('2026-05-20T00:00:00Z').getTime()]
    ])

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap, {
      resolveSourceId: (d) => buildDiaryEmbeddingSourceId('vlt_abc', d.id)
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(2)
  })

  it('includes diaries modified after indexing', () => {
    const diaries = [
      { id: 1, updatedAt: new Date('2026-05-21T00:00:00Z') },
      { id: 2, updatedAt: new Date('2026-05-20T00:00:00Z') }
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

  it('includes diaries indexed without updated_at metadata', () => {
    const diaries = [{ id: 1, updatedAt: new Date('2026-05-20T00:00:00Z') }]
    const embeddedIds = new Set(['1'])
    const embeddedUpdatedAtMap = new Map<string, number>()

    const result = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(1)
  })
})
