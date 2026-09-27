import {
  GRAPH_MAX_NEIGHBORS_PER_HOP,
  normalizeGraphName,
  type GraphRecallMode
} from '@baishou/shared'
import type { GraphEdgeRow, GraphNodeRow, GraphPath, GraphQuery } from '@baishou/database/shared'

export interface GraphRagPath {
  nodeIds: string[]
  nodeNames: string[]
  edges: GraphEdgeRow[]
  /** Parallel to edges — undirected BFS may walk an edge reverse of storage. */
  edgeDirections?: Array<'forward' | 'reverse'>
}

export interface GraphRagResult {
  anchors: GraphNodeRow[]
  subgraph: GraphEdgeRow[]
  timeline?: GraphEdgeRow[]
  nodes: GraphNodeRow[]
  /** Shortest relation paths (network mode). */
  paths?: GraphRagPath[]
}

export interface RecallRelationsOptions {
  vaultId: string
  entity: string
  mode: GraphRecallMode
  depth?: 1 | 2 | 3
  nodeType?: string
  limit?: number
  embedQuery?: (text: string) => Promise<number[] | null>
}

/**
 * GraphRAG: name/vector anchor → path (network) or timeline by validFrom.
 * Defaults to approved-only edges/nodes so pending review never reaches the Agent.
 */
export class GraphRagService {
  constructor(private readonly repo: GraphQuery) {}

  async recallRelations(opts: RecallRelationsOptions): Promise<GraphRagResult> {
    const entity = opts.entity.trim()
    if (!entity) {
      return { anchors: [], subgraph: [], nodes: [], paths: [] }
    }

    const limit = clampLimit(opts.limit)
    const nodeType = opts.nodeType?.trim().toLowerCase() || undefined
    const resolveQueryVector = createLazyQueryVector(opts.embedQuery, entity)

    if (opts.mode === 'search') {
      return this.searchEntities(opts.vaultId, entity, nodeType, limit)
    }

    const anchors = await this.resolveAnchors(opts.vaultId, entity, resolveQueryVector, nodeType)
    if (anchors.length === 0) {
      return { anchors: [], subgraph: [], nodes: [], paths: [] }
    }

    if (opts.mode === 'neighbors') {
      return this.listNeighbors(
        opts.vaultId,
        anchors,
        opts.depth ?? 1,
        nodeType,
        limit,
        resolveQueryVector
      )
    }

    if (opts.mode === 'timeline') {
      const center = anchors[0]!
      const view = await this.repo.listEntityTimeline(opts.vaultId, center.id, {
        approvedOnly: true
      })
      return {
        anchors: this.filterApprovedNodes(anchors),
        subgraph: view.edges.filter((e) => e.isCurrent),
        timeline: view.edges,
        nodes: view.nodes,
        paths: []
      }
    }

    const approvedAnchors = this.filterApprovedNodes(anchors)
    // Path depth capped at 2–3 hops (doc G-D11); never open beyond 3.
    const pathDepth: 2 | 3 = opts.depth === 2 ? 2 : 3

    const paths: GraphRagPath[] = []
    const nodeMap = new Map<string, GraphNodeRow>()
    const edgeMap = new Map<string, GraphEdgeRow>()

    for (const a of approvedAnchors) {
      nodeMap.set(a.id, a)
    }

    if (approvedAnchors.length >= 2) {
      const primary = approvedAnchors[0]!
      for (const other of approvedAnchors.slice(1, 5)) {
        const found = await this.repo.findShortestPath(opts.vaultId, primary.id, other.id, {
          maxHops: pathDepth,
          approvedOnly: true
        })
        if (found) {
          paths.push(await this.hydratePath(opts.vaultId, found, nodeMap))
          for (const e of found.edges) edgeMap.set(e.id, e)
        }
      }
      // Also try pairs among remaining anchors when primary↔other miss
      if (paths.length === 0 && approvedAnchors.length >= 3) {
        for (let i = 1; i < Math.min(approvedAnchors.length, 4); i++) {
          for (let j = i + 1; j < Math.min(approvedAnchors.length, 5); j++) {
            const a = approvedAnchors[i]!
            const b = approvedAnchors[j]!
            const found = await this.repo.findShortestPath(opts.vaultId, a.id, b.id, {
              maxHops: pathDepth,
              approvedOnly: true
            })
            if (found) {
              paths.push(await this.hydratePath(opts.vaultId, found, nodeMap))
              for (const e of found.edges) edgeMap.set(e.id, e)
            }
            if (paths.length >= 6) break
          }
          if (paths.length >= 6) break
        }
      }
    } else {
      const center = approvedAnchors[0]!
      const foundPaths = await this.repo.findPathsFrom(opts.vaultId, center.id, {
        maxHops: pathDepth,
        approvedOnly: true,
        limit
      })
      for (const found of foundPaths) {
        paths.push(await this.hydratePath(opts.vaultId, found, nodeMap))
        for (const e of found.edges) edgeMap.set(e.id, e)
      }
    }

    return {
      anchors: approvedAnchors,
      subgraph: [...edgeMap.values()],
      nodes: [...nodeMap.values()],
      paths: paths.slice(0, limit)
    }
  }

  private async searchEntities(
    vaultId: string,
    entity: string,
    nodeType: string | undefined,
    limit: number
  ): Promise<GraphRagResult> {
    const parts = await this.resolveQueryParts(vaultId, entity, nodeType)
    const seen = new Map<string, GraphNodeRow>()
    for (const part of parts) {
      const rows = preferExactName(
        this.filterApprovedNodes(
          await this.repo.searchNodesByName(vaultId, part, {
            nodeTypes: nodeType ? [nodeType] : undefined,
            limit
          })
        ),
        part
      )
      for (const n of rows) seen.set(n.id, n)
    }
    const nodes = rankAnchorsByExact([...seen.values()], parts).slice(0, limit)
    return { anchors: nodes, subgraph: [], nodes, paths: [] }
  }

  private async listNeighbors(
    vaultId: string,
    anchors: GraphNodeRow[],
    depth: 1 | 2 | 3,
    nodeType: string | undefined,
    limit: number,
    resolveQueryVector?: () => Promise<number[] | null>
  ): Promise<GraphRagResult> {
    const hops: 1 | 2 | 3 = depth === 2 || depth === 3 ? depth : 1
    const center = anchors[0]!
    const view = await this.repo.traverse(vaultId, center.id, hops, {
      approvedOnly: true,
      resolveQueryVector,
      maxNeighborsPerHop: GRAPH_MAX_NEIGHBORS_PER_HOP
    })
    let nodes = this.filterApprovedNodes(view.nodes)
    if (nodeType) {
      nodes = nodes.filter((n) => n.id === center.id || n.nodeType === nodeType)
    }
    const limited: GraphNodeRow[] = []
    const keep = new Set<string>()
    const centerNode = nodes.find((n) => n.id === center.id)
    if (centerNode) {
      limited.push(centerNode)
      keep.add(centerNode.id)
    }
    for (const n of nodes) {
      if (keep.has(n.id)) continue
      if (limited.length >= limit + 1) break
      limited.push(n)
      keep.add(n.id)
    }
    const edges = view.edges.filter((e) => keep.has(e.fromId) && keep.has(e.toId))
    return {
      anchors: [center],
      subgraph: edges,
      nodes: limited,
      paths: []
    }
  }

  private async hydratePath(
    vaultId: string,
    path: GraphPath,
    nodeMap: Map<string, GraphNodeRow>
  ): Promise<GraphRagPath> {
    const missing = path.nodeIds.filter((id) => !nodeMap.has(id))
    for (const id of missing) {
      const node = await this.repo.getNodeById(id, vaultId)
      if (node && node.reviewStatus !== 'pending' && node.reviewStatus !== 'rejected') {
        nodeMap.set(node.id, node)
      }
    }
    const nodeNames = path.nodeIds.map((id) => nodeMap.get(id)?.name || id.slice(0, 8))
    return {
      nodeIds: path.nodeIds,
      nodeNames,
      edges: path.edges,
      edgeDirections: path.edgeDirections
    }
  }

  private filterApprovedNodes(nodes: GraphNodeRow[]): GraphNodeRow[] {
    return nodes.filter((n) => n.reviewStatus !== 'pending' && n.reviewStatus !== 'rejected')
  }

  private async resolveQueryParts(
    vaultId: string,
    entity: string,
    nodeType?: string
  ): Promise<string[]> {
    const conjunction = splitEntityQuery(entity)
    if (conjunction.length >= 2) return conjunction
    const pair = spaceSeparatedNamePair(entity)
    if (!pair) return [entity.trim()]
    const [left, right] = pair
    const leftHits = this.filterApprovedNodes(
      await this.repo.searchNodesByName(vaultId, left, {
        limit: 8,
        nodeTypes: nodeType ? [nodeType] : undefined
      })
    )
    const rightHits = this.filterApprovedNodes(
      await this.repo.searchNodesByName(vaultId, right, {
        limit: 8,
        nodeTypes: nodeType ? [nodeType] : undefined
      })
    )
    if (leftHits.length > 0 && rightHits.length > 0) return pair
    return [entity.trim()]
  }

  private async resolveAnchors(
    vaultId: string,
    entity: string,
    resolveQueryVector?: () => Promise<number[] | null>,
    nodeType?: string
  ): Promise<GraphNodeRow[]> {
    const parts = await this.resolveQueryParts(vaultId, entity, nodeType)
    const seen = new Map<string, GraphNodeRow>()

    for (const part of parts) {
      const byName = preferExactName(
        this.filterApprovedNodes(
          await this.repo.searchNodesByName(vaultId, part, {
            limit: 8,
            nodeTypes: nodeType ? [nodeType] : undefined
          })
        ),
        part
      )
      for (const n of byName) seen.set(n.id, n)
    }

    if (seen.size > 0) return rankAnchorsByExact([...seen.values()], parts)

    if (resolveQueryVector) {
      try {
        const vector = await resolveQueryVector()
        if (vector?.length) {
          const hits = await this.repo.searchNodesByVector(vaultId, vector, 5)
          return hits
            .map(({ distance: _d, ...row }) => row)
            .filter((n) => n.reviewStatus !== 'pending' && n.reviewStatus !== 'rejected')
            .filter((n) => !nodeType || n.nodeType === nodeType)
        }
      } catch {
        // optional
      }
    }
    return []
  }
}

function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return 12
  return Math.min(20, Math.max(1, Math.floor(limit)))
}

function createLazyQueryVector(
  embedQuery: ((text: string) => Promise<number[] | null>) | undefined,
  entity: string
): (() => Promise<number[] | null>) | undefined {
  if (!embedQuery) return undefined
  let inflight: Promise<number[] | null> | undefined
  return () => {
    if (!inflight) {
      inflight = embedQuery(entity).catch(() => null)
    }
    return inflight
  }
}

/** Split compound entity queries into search terms. */
export function splitEntityQuery(entity: string): string[] {
  const trimmed = entity.trim()
  if (!trimmed) return []
  const parts = trimmed
    .split(/\s*(?:和|与|跟|以及|and|,|，|、)\s*/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 1)
  if (parts.length >= 2) return parts.slice(0, 4)
  return [trimmed]
}

export function spaceSeparatedNamePair(entity: string): [string, string] | null {
  const parts = entity
    .trim()
    .split(/\s+/)
    .filter((part) => part.length >= 1)
  if (parts.length === 2) return [parts[0]!, parts[1]!]
  return null
}

function nameMatchesQuery(node: GraphNodeRow, query: string): boolean {
  const key = normalizeGraphName(query)
  if (normalizeGraphName(node.name) === key) return true
  return (node.aliases ?? []).some((alias) => normalizeGraphName(alias) === key)
}

function preferExactName(rows: GraphNodeRow[], query: string): GraphNodeRow[] {
  return [...rows].sort((a, b) => {
    const left = nameMatchesQuery(a, query) ? 0 : 1
    const right = nameMatchesQuery(b, query) ? 0 : 1
    return left - right
  })
}

function rankAnchorsByExact(nodes: GraphNodeRow[], queries: string[]): GraphNodeRow[] {
  const exact: GraphNodeRow[] = []
  const rest: GraphNodeRow[] = []
  for (const node of nodes) {
    if (queries.some((query) => nameMatchesQuery(node, query))) exact.push(node)
    else rest.push(node)
  }
  return [...exact, ...rest]
}
