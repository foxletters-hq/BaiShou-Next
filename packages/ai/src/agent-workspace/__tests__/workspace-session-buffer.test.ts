import { describe, expect, it } from 'vitest'
import { WorkspaceSessionBuffer } from '../workspace-session-buffer'

describe('WorkspaceSessionBuffer', () => {
  it('collects file change parts for persistence', () => {
    const buffer = new WorkspaceSessionBuffer()
    buffer.push({
      path: 'README.md',
      kind: 'modify',
      additions: 2,
      deletions: 1
    })
    buffer.push({
      path: 'notes.txt',
      kind: 'create',
      additions: 10,
      deletions: 0
    })

    expect(buffer.buildPartDataList()).toHaveLength(2)
    expect(buffer.buildPartDataList()[0]?.path).toBe('README.md')
  })

  it('clears collected changes', () => {
    const buffer = new WorkspaceSessionBuffer()
    buffer.push({ path: 'a.md', kind: 'modify', additions: 1, deletions: 0 })
    buffer.clear()
    expect(buffer.buildPartDataList()).toEqual([])
  })
})
