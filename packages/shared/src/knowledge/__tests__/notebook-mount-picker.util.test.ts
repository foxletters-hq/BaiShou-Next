import { describe, expect, it } from 'vitest'
import { canToggleMountedNotebook, toggleMountedNotebook } from '../notebook-mount-picker.util'

const candidates = [
  { id: 'a', name: '制度', sources: 2, chunks: 10, dimension: 1024 },
  { id: 'b', name: '手册', sources: 1, chunks: 8, dimension: 1024 },
  { id: 'c', name: '研究', sources: 1, chunks: 4, dimension: 768 },
  { id: 'd', name: '混杂', sources: 1, chunks: 3, dimension: null, mixedEmbeddings: true }
]

describe('notebook-mount-picker.util', () => {
  it('allows up to three same-dimension notebooks', () => {
    expect(
      toggleMountedNotebook({ selectedIds: ['a'], candidateId: 'b', candidates }).next
    ).toEqual(['a', 'b'])
    expect(
      canToggleMountedNotebook({
        selectedIds: ['a', 'b'],
        candidate: candidates[2]!,
        candidates
      }).allowed
    ).toBe(false)
  })

  it('blocks mixed or different dimensions', () => {
    expect(
      canToggleMountedNotebook({
        selectedIds: [],
        candidate: candidates[3]!,
        candidates
      })
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/重新嵌入/) })
    expect(
      toggleMountedNotebook({ selectedIds: ['a'], candidateId: 'c', candidates }).error
    ).toMatch(/维度不同/)
  })
})
