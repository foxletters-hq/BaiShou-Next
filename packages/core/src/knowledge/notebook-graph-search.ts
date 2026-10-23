import type { NotebookGraphQuery } from '@baishou/database/shared'
import { runGraphModeSearch, type ToolKnowledgeGraphSearchResult } from '@baishou/shared'

type NotebookGraphAnchor = {
  id: string
  name: string
  nodeType: string
  summary?: string
}

type NotebookGraphToolRepo = NotebookGraphQuery & {
  searchNodesByVector?: (
    vaultId: string,
    notebookId: string,
    vector: number[],
    topK: number,
    opts?: { nodeType?: string; modelId?: string }
  ) => Promise<Array<NotebookGraphAnchor & { distance?: number }>>
}

const QUERY_TERM_SPLIT = /[\s、，,]+/

/** Shared tool-shaped notebook graph search for desktop and mobile hosts. */
export async function searchNotebookGraphForTool(
  repo: NotebookGraphToolRepo,
  opts: {
    vaultId: string
    notebookId: string
    query: string
    limit?: number
    embedQuery?: (text: string) => Promise<number[] | null>
    modelId?: string
  }
): Promise<ToolKnowledgeGraphSearchResult> {
  const notebookId = opts.notebookId.trim()
  const vaultId = opts.vaultId.trim()
  if (!notebookId) throw new Error('notebookId required')
  if (!vaultId) throw new Error('vaultId required')

  const limit = opts.limit ?? 8
  const anchors = await resolveNotebookGraphAnchors(repo, {
    vaultId,
    notebookId,
    query: opts.query,
    limit,
    embedQuery: opts.embedQuery,
    modelId: opts.modelId
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

  const nodes = mergeAnchorNodes(
    view.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      nodeType: n.nodeType,
      summary: n.summary
    })),
    anchors
  )

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
          const n = nodes.find((row) => row.id === id) || anchors.find((row) => row.id === id)
          return n?.name || id.slice(0, 8)
        }),
        excerpts: found.edges.map((e) => e.sourceExcerpt || e.sourceRef || '')
      })
    }
  }

  return {
    nodes: nodes.map((n) => ({
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

async function resolveNotebookGraphAnchors(
  repo: NotebookGraphToolRepo,
  opts: {
    vaultId: string
    notebookId: string
    query: string
    limit: number
    embedQuery?: (text: string) => Promise<number[] | null>
    modelId?: string
  }
): Promise<NotebookGraphAnchor[]> {
  const seen = new Map<string, NotebookGraphAnchor>()
  const push = (rows: NotebookGraphAnchor[]) => {
    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.set(row.id, { id: row.id, name: row.name, nodeType: row.nodeType, summary: row.summary })
    }
  }

  if (opts.embedQuery && repo.searchNodesByVector) {
    try {
      const vectorHits = await runGraphModeSearch({
        mode: 'semantic',
        query: opts.query,
        embedQuery: opts.embedQuery,
        modelId: opts.modelId,
        searchName: async () => [],
        searchVector: (vector, modelId) =>
          repo.searchNodesByVector!(opts.vaultId, opts.notebookId, vector, opts.limit, { modelId })
      })
      push(vectorHits)
    } catch {
      // 向量检索失败时退回名称，避免工具整轮不可用
    }
  }

  if (seen.size < opts.limit) {
    for (const term of notebookGraphQueryTerms(opts.query)) {
      if (seen.size >= opts.limit) break
      push(
        await repo.searchNodes({
          vaultId: opts.vaultId,
          notebookId: opts.notebookId,
          query: term,
          limit: opts.limit
        })
      )
    }
  }

  return [...seen.values()].slice(0, opts.limit)
}

function notebookGraphQueryTerms(query: string): string[] {
  const full = query.trim()
  if (!full) return []
  const parts = full
    .split(QUERY_TERM_SPLIT)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  const terms = [full]
  for (const part of parts) {
    if (part !== full) terms.push(part)
  }
  return terms.slice(0, 8)
}

function mergeAnchorNodes(
  viewNodes: NotebookGraphAnchor[],
  anchors: NotebookGraphAnchor[]
): NotebookGraphAnchor[] {
  const byId = new Map<string, NotebookGraphAnchor>()
  for (const node of anchors) byId.set(node.id, node)
  for (const node of viewNodes) {
    if (!byId.has(node.id)) byId.set(node.id, node)
  }
  return [...byId.values()]
}
