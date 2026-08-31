import { describe, expect, it } from 'vitest'
import {
  fileChangeFromMutateInvocation,
  isWorkspaceFileMutateTool
} from '../file-change-from-tool.util'

describe('isWorkspaceFileMutateTool', () => {
  it('recognizes write/patch/delete/rename', () => {
    expect(isWorkspaceFileMutateTool('workspace_write')).toBe(true)
    expect(isWorkspaceFileMutateTool('workspace_read')).toBe(false)
  })
})

describe('fileChangeFromMutateInvocation', () => {
  it('builds an addition diff for write content', () => {
    const data = fileChangeFromMutateInvocation({
      toolCallId: 'c1',
      toolName: 'workspace_write',
      args: { path: 'notes/a.md', content: 'hello\nworld' }
    })

    expect(data).toMatchObject({
      path: 'notes/a.md',
      kind: 'create',
      additions: 2,
      toolCallId: 'c1'
    })
    expect(data?.diff).toBe('+hello\n+world')
  })

  it('builds a replacement diff for patch text', () => {
    const data = fileChangeFromMutateInvocation({
      toolName: 'workspace_patch',
      args: { path: 'a.md', old_text: 'a', new_text: 'b' }
    })

    expect(data).toMatchObject({ kind: 'modify', path: 'a.md' })
    expect(data?.diff).toBe('-a\n+b')
  })
})
