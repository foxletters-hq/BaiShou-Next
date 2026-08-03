import { describe, expect, it, vi } from 'vitest'
import type { ToolContext } from '../agent.tool'
import { KnowledgeSearchTool } from '../knowledge-search.tool'

describe('KnowledgeSearchTool', () => {
  const tool = new KnowledgeSearchTool()

  it('errors clearly when notebookId is missing', async () => {
    const search = vi.fn()
    const context = {
      knowledgeReader: { search },
      workspace: { folderRoot: '/tmp', sessionKind: 'workspace' }
    } as unknown as ToolContext

    const result = await tool.execute({ query: '对齐' }, context)
    expect(result).toMatch(/No knowledge notebook is attached|notebookId/i)
    expect(search).not.toHaveBeenCalled()
  })

  it('uses workspace.notebookId when args omit notebookId', async () => {
    const search = vi.fn().mockResolvedValue([
      {
        chunkId: 'c1',
        sourceId: 'src1',
        notebookId: 'nb1',
        chunkIndex: 0,
        chunkText: '对齐分歧……',
        score: 0.9,
        title: 'report.pdf'
      }
    ])
    const context = {
      knowledgeReader: { search },
      workspace: {
        folderRoot: '/tmp',
        sessionKind: 'workspace',
        notebookId: 'nb1'
      }
    } as unknown as ToolContext

    const result = await tool.execute({ query: '对齐' }, context)
    expect(search).toHaveBeenCalledWith({ query: '对齐', notebookId: 'nb1', limit: 8 })
    expect(result).toContain('report.pdf')
    expect(result).toContain('对齐分歧')
  })

  it('returns clear message when knowledgeReader is absent', async () => {
    const context = {
      workspace: { folderRoot: '/tmp', sessionKind: 'workspace', notebookId: 'nb1' }
    } as unknown as ToolContext

    const result = await tool.execute({ query: '对齐' }, context)
    expect(result).toMatch(/not available/i)
  })

  it('forces workspace attached notebookId over args (K1.3)', async () => {
    const search = vi.fn().mockResolvedValue([])
    const context = {
      knowledgeReader: { search },
      workspace: {
        folderRoot: '/tmp',
        sessionKind: 'workspace',
        notebookId: 'nb-attached'
      }
    } as unknown as ToolContext

    await tool.execute({ query: '对齐', notebookId: 'nb-other' }, context)
    expect(search).toHaveBeenCalledWith({
      query: '对齐',
      notebookId: 'nb-attached',
      limit: 8
    })
  })
})
