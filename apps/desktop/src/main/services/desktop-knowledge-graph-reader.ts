import { KnowledgeGraphReaderAdapter } from '@baishou/ai'
import type { ToolKnowledgeGraphReader, ToolKnowledgeGraphSearchResult } from '@baishou/shared'
import { parseMountedNotebookIds } from '@baishou/shared'
import { searchNotebookGraphForTool } from '@baishou/core-desktop'
import {
  KnowledgeRepository,
  NotebookGraphRepository,
  knowledgeConnectionManager
} from '@baishou/database-desktop'
import { resolveActiveVaultId } from '../ipc/vault.ipc'

export function createDesktopKnowledgeGraphReader(): ToolKnowledgeGraphReader | undefined {
  if (!knowledgeConnectionManager.isConnected()) return undefined
  const repo = new NotebookGraphRepository(knowledgeConnectionManager.getDb())
  const knowledgeRepo = new KnowledgeRepository(knowledgeConnectionManager.getDb())

  return new KnowledgeGraphReaderAdapter(async (opts) => {
    const vaultId = resolveActiveVaultId()?.trim() || ''
    if (!vaultId) throw new Error('active vault not ready')
    const notebookIds = parseMountedNotebookIds(opts.notebookIds)
    const profiles = await knowledgeRepo.listNotebookEmbeddingProfiles({ vaultId, notebookIds })
    const nameById = new Map(profiles.map((row) => [row.notebookId, row.notebookName]))
    const notebooks = await knowledgeRepo.listNotebooks({ vaultId })
    for (const notebook of notebooks) {
      if (!nameById.has(notebook.id)) nameById.set(notebook.id, notebook.name)
    }

    const groups: ToolKnowledgeGraphSearchResult[] = []
    for (const notebookId of notebookIds) {
      const result = await searchNotebookGraphForTool(repo, {
        vaultId,
        notebookId,
        query: opts.query,
        limit: opts.limit
      })
      groups.push({
        notebookId,
        notebookName: nameById.get(notebookId) || notebookId,
        nodes: result.nodes.map((node) => ({ ...node, notebookId })),
        edges: result.edges.map((edge) => ({ ...edge, notebookId })),
        paths: result.paths
      })
    }
    return groups
  })
}
