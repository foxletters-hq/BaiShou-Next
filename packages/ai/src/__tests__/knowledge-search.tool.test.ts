import { describe, expect, it, vi } from 'vitest'
import { deriveLegacyVaultId } from '@baishou/shared'
import { KnowledgeSearchTool } from '../tools/knowledge-search.tool'

describe('KnowledgeSearchTool mount gate', () => {
  const tool = new KnowledgeSearchTool()

  it('工作台未挂载时拒绝，且不可用 notebookId 绕过', async () => {
    const search = vi.fn()
    const result = await tool.execute({ query: 'hello', notebookId: 'nb_bypass' }, {
      sessionId: 'ws1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      workspace: { folderRoot: '/tmp/p', sessionKind: 'workspace' },
      knowledgeReader: { search }
    } as any)
    expect(result).toMatch(/尚未挂载|不可通过 notebookId/)
    expect(search).not.toHaveBeenCalled()
  })

  it('工作台已挂载时使用挂载 notebookIds', async () => {
    const search = vi.fn().mockResolvedValue([])
    await tool.execute({ query: 'hello' }, {
      sessionId: 'ws1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      workspace: {
        folderRoot: '/tmp/p',
        sessionKind: 'workspace',
        notebookIds: ['nb_mounted']
      },
      knowledgeReader: { search }
    } as any)
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ notebookIds: ['nb_mounted'], query: 'hello' })
    )
  })
})
