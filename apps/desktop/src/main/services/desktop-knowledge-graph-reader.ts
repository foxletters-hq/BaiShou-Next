import { KnowledgeGraphReaderAdapter } from '@baishou/ai'
import type { ToolKnowledgeGraphReader } from '@baishou/shared'
import { searchNotebookGraphForTool } from '@baishou/core-desktop'
import { NotebookGraphRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import { resolveActiveVaultId } from '../ipc/vault.ipc'

export function createDesktopKnowledgeGraphReader(): ToolKnowledgeGraphReader | undefined {
  if (!knowledgeConnectionManager.isConnected()) return undefined
  const repo = new NotebookGraphRepository(knowledgeConnectionManager.getDb())

  return new KnowledgeGraphReaderAdapter(async (opts) => {
    const vaultId = resolveActiveVaultId()?.trim() || ''
    if (!vaultId) throw new Error('active vault not ready')
    return searchNotebookGraphForTool(repo, {
      vaultId,
      notebookId: opts.notebookId,
      query: opts.query,
      limit: opts.limit
    })
  })
}
