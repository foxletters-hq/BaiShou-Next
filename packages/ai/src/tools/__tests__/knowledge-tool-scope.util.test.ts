import { describe, expect, it } from 'vitest'
import type { ToolContext } from '../agent.tool'
import { resolveKnowledgeToolNotebookId } from '../knowledge-tool-scope.util'

describe('resolveKnowledgeToolNotebookId', () => {
  it('lets companion choose notebookId only when none is bound', () => {
    const context = {
      workspace: { folderRoot: '', sessionKind: 'companion' }
    } as unknown as ToolContext

    expect(resolveKnowledgeToolNotebookId(context, 'nb-arg')).toEqual({ notebookId: 'nb-arg' })
  })

  it('keeps the bound notebook even if companion args send another id', () => {
    const context = {
      workspace: { folderRoot: '', sessionKind: 'companion', notebookId: 'nb-bound' }
    } as unknown as ToolContext

    expect(resolveKnowledgeToolNotebookId(context, 'nb-other')).toEqual({
      notebookId: 'nb-bound'
    })
  })
})
