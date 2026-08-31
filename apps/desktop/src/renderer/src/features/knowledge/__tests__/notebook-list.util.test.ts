import { describe, expect, it } from 'vitest'
import {
  applyNotebookDragReorder,
  moveNotebookIndex,
  resolveNotebookCoverPreviewUrl,
  resolveNotebookRename,
  sortNotebooksForList
} from '../notebook-list.util'

describe('notebook-list.util', () => {
  it('sorts by sortOrder then newer createdAt', () => {
    const sorted = sortNotebooksForList([
      { id: 'c', sortOrder: 2, createdAt: 30 },
      { id: 'a', sortOrder: 0, createdAt: 10 },
      { id: 'b', sortOrder: 0, createdAt: 20 }
    ])
    expect(sorted.map((row) => row.id)).toEqual(['b', 'a', 'c'])
  })

  it('moves an item to a new index', () => {
    const next = moveNotebookIndex(['a', 'b', 'c', 'd'], 1, 3)
    expect(next).toEqual(['a', 'c', 'd', 'b'])
    expect(moveNotebookIndex(['a', 'b'], 0, 0)).toEqual(['a', 'b'])
  })

  it('reorders by the card under the pointer, including left and right neighbors', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    expect(applyNotebookDragReorder(list, 'b', 'd')?.map((row) => row.id)).toEqual([
      'a',
      'c',
      'd',
      'b'
    ])
    expect(applyNotebookDragReorder(list, 'd', 'a')?.map((row) => row.id)).toEqual([
      'd',
      'a',
      'b',
      'c'
    ])
    expect(applyNotebookDragReorder(list, 'a', 'a')).toBeNull()
  })

  it('only commits a renamed notebook when the name actually changes', () => {
    expect(resolveNotebookRename('研究本', '  安全笔记  ')).toBe('安全笔记')
    expect(resolveNotebookRename('研究本', '研究本')).toBeNull()
    expect(resolveNotebookRename('研究本', '   ')).toBeNull()
  })

  it('appends a cache-busting stamp to the cover image url', () => {
    expect(resolveNotebookCoverPreviewUrl(null, 12)).toBeNull()
    expect(resolveNotebookCoverPreviewUrl('local:///a/cover.png', 99)).toBe(
      'local:///a/cover.png?t=99'
    )
    expect(resolveNotebookCoverPreviewUrl('local:///a/cover.png?x=1', 99)).toBe(
      'local:///a/cover.png?x=1&t=99'
    )
  })
})
