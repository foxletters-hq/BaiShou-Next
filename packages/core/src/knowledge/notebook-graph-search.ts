import type { NotebookGraphQuery } from '@baishou/database/shared'
import type { ToolKnowledgeGraphSearchResult } from '@baishou/shared'

/** Shared tool-shaped notebook graph search for desktop and mobile hosts. */
export async function searchNotebookGraphForTool(
  repo: NotebookGraphQuery,
  opts: { vaultId: string; notebookId: string; query: string; limit?: number }
): Promise<ToolKnowledgeGraphSearchResult> {
  const notebookId = opts.notebookId.trim()
  const vaultId = opts.vaultId.trim()
  if (!notebookId) throw new Error('notebookId required')
  if (!vaultId) throw new Error('vaultId required')

  const anchors = await repo.searchNodes({
    vaultId,
    notebookId,
    query: opts.query,
    limit: opts.limit ?? 8
  })
  if (anchors.length === 0) {
    return { nodes: [], edges: [], paths: [] }
  }

  const view =
    anchors.length === 1
      ? await repo.getNeighborhood({
          vaultId,
          notebookId,
          nodeId: anchors[0]!.id,
          maxNodes: 80
        })
      : await repo.getView({ vaultId, notebookId, maxNodes: 80 })

  const paths: Array<{ nodeNames: string[]; excerpts: string[] }> = []
  if (anchors.length >= 2) {
    const found = await repo.findShortestPath({
      vaultId,
      notebookId,
      fromId: anchors[0]!.id,
      toId: anchors[1]!.id
    })
    if (found) {
      paths.push({
        nodeNames: found.nodeIds.map((id) => {
          const n = view.nodes.find((row) => row.id === id) || anchors.find((row) => row.id === id)
          return n?.name || id.slice(0, 8)
        }),
        excerpts: found.edges.map((e) => e.sourceExcerpt || e.sourceRef || '')
      })
    }
  }

  return {
    nodes: view.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      nodeType: n.nodeType,
      summary: n.summary
    })),
    edges: view.edges.map((e) => ({
      id: e.id,
      fromId: e.fromId,
      toId: e.toId,
      edgeType: e.edgeType,
      sourceExcerpt: e.sourceExcerpt
    })),
    paths
  }
}
