import { describe, expect, it, vi } from 'vitest'
import type { ToolContext } from '../agent.tool'
import { KnowledgeGraphSearchTool } from '../knowledge-graph-search.tool'

describe('KnowledgeGraphSearchTool', () => {
  const tool = new KnowledgeGraphSearchTool()

  it('工作台未挂载本子时拒绝', async () => {
    const search = vi.fn()
    const context = {
      knowledgeGraphReader: { search },
      workspace: { folderRoot: '/tmp', sessionKind: 'workspace' }
    } as unknown as ToolContext

    const result = await tool.execute({ query: '对齐' }, context)
    expect(result).toMatch(/挂载|notebookId/i)
    expect(search).not.toHaveBeenCalled()
  })

  it('工作台强制使用已挂载 notebookIds', async () => {
    const search = vi.fn().mockResolvedValue([
      {
        notebookId: 'nb-attached',
        notebookName: '手册',
        nodes: [{ id: 'n1', name: '对齐', nodeType: 'topic', summary: '分歧' }],
        edges: [],
        paths: []
      }
    ])
    const context = {
      knowledgeGraphReader: { search },
      workspace: {
        folderRoot: '/tmp',
        sessionKind: 'workspace',
        notebookIds: ['nb-attached']
      }
    } as unknown as ToolContext

    await tool.execute({ query: '对齐' }, context)
    expect(search).toHaveBeenCalledWith({
      query: '对齐',
      notebookIds: ['nb-attached'],
      limit: 8
    })
  })

  it('已挂载时拒绝越界 notebookId', async () => {
    const search = vi.fn().mockResolvedValue([])
    const context = {
      knowledgeGraphReader: { search },
      workspace: {
        folderRoot: '',
        sessionKind: 'companion',
        notebookIds: ['nb-bound']
      }
    } as unknown as ToolContext

    const result = await tool.execute({ query: '对齐', notebookId: 'nb-other' }, context)
    expect(result).toMatch(/不在已挂载集合/)
    expect(search).not.toHaveBeenCalled()
  })

  it('缺 reader 时明确提示', async () => {
    const context = {
      workspace: { folderRoot: '/tmp', sessionKind: 'workspace', notebookIds: ['nb1'] }
    } as unknown as ToolContext
    const result = await tool.execute({ query: '对齐' }, context)
    expect(result).toMatch(/不可用/)
  })
})
