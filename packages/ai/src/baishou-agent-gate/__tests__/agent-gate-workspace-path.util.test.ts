import { describe, expect, it } from 'vitest'
import { classifyWorkspacePathForGate } from '../agent-gate-workspace-path.util'

describe('classifyWorkspacePathForGate', () => {
  it('keeps relative in-sandbox paths as workspace_path', () => {
    expect(classifyWorkspacePathForGate('src/foo.ts', 'D:/proj')).toEqual({
      kind: 'workspace_path',
      value: 'src/foo.ts'
    })
  })

  it('marks traversal as external_path', () => {
    expect(classifyWorkspacePathForGate('../outside.txt', 'D:/proj')).toEqual({
      kind: 'external_path',
      value: '../outside.txt'
    })
  })

  it('marks absolute outside root as external_path', () => {
    expect(classifyWorkspacePathForGate('C:/Outside/a.txt', 'D:/proj')).toEqual({
      kind: 'external_path',
      value: 'C:/Outside/a.txt'
    })
  })

  it('maps absolute path under folderRoot to workspace_path', () => {
    expect(classifyWorkspacePathForGate('D:/proj/src/a.ts', 'D:/proj')).toEqual({
      kind: 'workspace_path',
      value: 'src/a.ts'
    })
  })
})
