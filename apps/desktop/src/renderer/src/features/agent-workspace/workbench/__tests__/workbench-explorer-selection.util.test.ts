import { describe, expect, it } from 'vitest'
import {
  findExplorerNode,
  flattenVisibleExplorerNodes,
  nextExplorerSelection,
  readWorkbenchRevealPath,
  resolveExplorerAddToChatEntries,
  resolveExplorerDragEntries
} from '../workbench-explorer-selection.util'

const nodes = [
  { relativePath: 'a.md', isDirectory: false },
  {
    relativePath: 'docs',
    isDirectory: true
  },
  { relativePath: 'b.md', isDirectory: false }
]

const children: Record<string, typeof nodes> = {
  docs: [
    { relativePath: 'docs/one.md', isDirectory: false },
    { relativePath: 'docs/two.md', isDirectory: false }
  ]
}

describe('flattenVisibleExplorerNodes', () => {
  it('should include expanded folder children and skip collapsed ones', () => {
    const expanded = flattenVisibleExplorerNodes(
      nodes,
      (path) => children[path] ?? [],
      (path) => path === 'docs'
    )
    expect(expanded.map((node) => node.relativePath)).toEqual([
      'a.md',
      'docs',
      'docs/one.md',
      'docs/two.md',
      'b.md'
    ])

    const collapsed = flattenVisibleExplorerNodes(
      nodes,
      (path) => children[path] ?? [],
      () => false
    )
    expect(collapsed.map((node) => node.relativePath)).toEqual(['a.md', 'docs', 'b.md'])
  })
})

describe('nextExplorerSelection', () => {
  const visible = ['a.md', 'docs', 'docs/one.md', 'b.md']

  it('should replace the selection on a plain click', () => {
    expect(
      nextExplorerSelection({
        visiblePaths: visible,
        current: ['a.md'],
        clicked: 'docs/one.md',
        additive: false,
        range: false,
        anchor: 'a.md'
      })
    ).toEqual({ selected: ['docs/one.md'], anchor: 'docs/one.md' })
  })

  it('should toggle the clicked path when additive', () => {
    expect(
      nextExplorerSelection({
        visiblePaths: visible,
        current: ['a.md'],
        clicked: 'b.md',
        additive: true,
        range: false,
        anchor: 'a.md'
      })
    ).toEqual({ selected: ['a.md', 'b.md'], anchor: 'b.md' })

    expect(
      nextExplorerSelection({
        visiblePaths: visible,
        current: ['a.md', 'b.md'],
        clicked: 'a.md',
        additive: true,
        range: false,
        anchor: 'b.md'
      })
    ).toEqual({ selected: ['b.md'], anchor: 'a.md' })
  })

  it('should select the visible range when shift-clicking', () => {
    expect(
      nextExplorerSelection({
        visiblePaths: visible,
        current: ['a.md'],
        clicked: 'docs/one.md',
        additive: false,
        range: true,
        anchor: 'a.md'
      })
    ).toEqual({ selected: ['a.md', 'docs', 'docs/one.md'], anchor: 'a.md' })
  })
})

describe('resolveExplorerDragEntries', () => {
  it('should drag the whole selection when the dragged node is selected', () => {
    expect(
      resolveExplorerDragEntries({ relativePath: 'a.md', isDirectory: false }, [
        { relativePath: 'a.md', isDirectory: false },
        { relativePath: 'docs', isDirectory: true }
      ])
    ).toEqual([
      { relativePath: 'a.md', isDirectory: false },
      { relativePath: 'docs', isDirectory: true }
    ])
  })

  it('should drag only the clicked node when it is outside the selection', () => {
    expect(
      resolveExplorerDragEntries({ relativePath: 'b.md', isDirectory: false }, [
        { relativePath: 'a.md', isDirectory: false }
      ])
    ).toEqual([{ relativePath: 'b.md', isDirectory: false }])
  })
})

describe('resolveExplorerAddToChatEntries', () => {
  it('should add every selected entry when the menu target is in the selection', () => {
    expect(
      resolveExplorerAddToChatEntries({ relativePath: 'docs', isDirectory: true }, [
        { relativePath: 'a.md', isDirectory: false },
        { relativePath: 'docs', isDirectory: true }
      ])
    ).toHaveLength(2)
  })

  it('should add only the target when it is not selected', () => {
    expect(
      resolveExplorerAddToChatEntries({ relativePath: 'b.md', isDirectory: false }, [
        { relativePath: 'a.md', isDirectory: false }
      ])
    ).toEqual([{ relativePath: 'b.md', isDirectory: false }])
  })
})

describe('findExplorerNode', () => {
  it('should find a nested file among loaded children', () => {
    const found = findExplorerNode(nodes, 'docs/two.md', (path) => children[path] ?? [])
    expect(found?.relativePath).toBe('docs/two.md')
  })
})

describe('readWorkbenchRevealPath', () => {
  it('should read a reveal event detail', () => {
    const event = new CustomEvent('baishou:workspace-reveal-path', {
      detail: { relativePath: 'docs', isDirectory: true }
    })
    expect(readWorkbenchRevealPath(event)).toEqual({
      relativePath: 'docs',
      isDirectory: true
    })
  })

  it('should ignore an empty reveal path', () => {
    expect(
      readWorkbenchRevealPath(new CustomEvent('x', { detail: { relativePath: '' } }))
    ).toBeNull()
  })
})
