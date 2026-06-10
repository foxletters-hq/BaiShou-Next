import { describe, it, expect } from 'vitest'
import { sortDiariesByDateAsc, sortDiariesByDateDesc } from '../rag-diary.util'

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
