import { describe, expect, it, vi } from 'vitest'
import type { ToolContext } from '../agent.tool'
import { KnowledgeSearchTool } from '../knowledge-search.tool'

describe('KnowledgeSearchTool', () => {
  const tool = new KnowledgeSearchTool()

  it('errors clearly when nothing is mounted', async () => {
    const search = vi.fn()
    const context = {
      knowledgeReader: { search },
      workspace: { folderRoot: '/tmp', sessionKind: 'workspace' }
    } as unknown as ToolContext

    const result = await tool.execute({ query: '对齐' }, context)
    expect(result).toMatch(/尚未挂载/)
    expect(search).not.toHaveBeenCalled()
  })

  it('searches all mounted notebooks when args omit notebookId', async () => {
    const search = vi.fn().mockResolvedValue([
      {
        chunkId: 'c1',
        sourceId: 'src1',
        notebookId: 'nb1',
        notebookName: '手册',
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
        notebookIds: ['nb1']
      }
    } as unknown as ToolContext

    const result = await tool.execute({ query: '对齐' }, context)
    expect(search).toHaveBeenCalledWith({ query: '对齐', notebookIds: ['nb1'], limit: 8 })
    expect(result).toContain('report.pdf')
    expect(result).toContain('对齐分歧')
  })

  it('returns clear message when knowledgeReader is absent', async () => {
    const context = {
      workspace: { folderRoot: '/tmp', sessionKind: 'workspace', notebookIds: ['nb1'] }
    } as unknown as ToolContext

    const result = await tool.execute({ query: '对齐' }, context)
    expect(result).toMatch(/不可用/)
  })

  it('rejects companion args.notebookId outside the mounted set', async () => {
    const search = vi.fn().mockResolvedValue([])
    const context = {
      knowledgeReader: { search },
      workspace: {
        folderRoot: '',
        sessionKind: 'companion',
        notebookIds: ['nb-bound']
      }
    } as unknown as ToolContext

    const result = await tool.execute({ query: '蒙太奇', notebookId: 'nb-other' }, context)
    expect(result).toMatch(/不在已挂载集合/)
    expect(search).not.toHaveBeenCalled()
  })

  it('uses the mounted notebooks when companion args omit notebookId', async () => {
    const search = vi.fn().mockResolvedValue([])
    const context = {
      knowledgeReader: { search },
      workspace: {
        folderRoot: '',
        sessionKind: 'companion',
        notebookIds: ['nb-bound']
      }
    } as unknown as ToolContext

    const result = await tool.execute({ query: '蒙太奇' }, context)
    expect(search).toHaveBeenCalledWith({ query: '蒙太奇', notebookIds: ['nb-bound'], limit: 8 })
    expect(result).toContain('没有找到')
  })

  it('forces workspace attached notebookIds over args (K1.3)', async () => {
    const search = vi.fn().mockResolvedValue([])
    const context = {
      knowledgeReader: { search },
      workspace: {
        folderRoot: '/tmp',
        sessionKind: 'workspace',
        notebookIds: ['nb-attached']
      }
    } as unknown as ToolContext

    const result = await tool.execute({ query: '对齐', notebookId: 'nb-other' }, context)
    expect(result).toMatch(/不在已挂载集合/)
    expect(search).not.toHaveBeenCalled()
  })
})
