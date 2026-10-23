import { describe, expect, it } from 'vitest'
import type { ToolContext } from '../agent.tool'
import { resolveKnowledgeToolNotebookIds } from '../knowledge-tool-scope.util'

describe('resolveKnowledgeToolNotebookIds', () => {
  it('rejects when nothing is mounted, even if args send an id', () => {
    const context = {
      workspace: { folderRoot: '', sessionKind: 'companion' }
    } as unknown as ToolContext

    expect(resolveKnowledgeToolNotebookIds(context, 'nb-arg')).toMatchObject({
      notebookIds: [],
      error: expect.stringMatching(/尚未挂载/)
    })
  })

  it('returns all mounted notebooks when args omit notebookId', () => {
    const context = {
      workspace: { folderRoot: '', sessionKind: 'companion', notebookIds: ['nb-a', 'nb-b'] }
    } as unknown as ToolContext

    expect(resolveKnowledgeToolNotebookIds(context)).toEqual({
      notebookIds: ['nb-a', 'nb-b']
    })
  })

  it('accepts a subset that is already mounted', () => {
    const context = {
      workspace: { folderRoot: '/tmp', sessionKind: 'workspace', notebookIds: ['nb-a', 'nb-b'] }
    } as unknown as ToolContext

    expect(resolveKnowledgeToolNotebookIds(context, 'nb-b')).toEqual({
      notebookIds: ['nb-b']
    })
  })

  it('rejects a notebookId outside the mounted set', () => {
    const context = {
      workspace: { folderRoot: '', sessionKind: 'companion', notebookIds: ['nb-bound'] }
    } as unknown as ToolContext

    expect(resolveKnowledgeToolNotebookIds(context, 'nb-other')).toMatchObject({
      notebookIds: [],
      error: expect.stringMatching(/不在已挂载集合/)
    })
  })
})
