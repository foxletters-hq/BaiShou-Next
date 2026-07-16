import type { GraphEdgeRow, GraphNodeRow, GraphRepository } from '@baishou/database'

export interface GraphRagResult {
  anchors: GraphNodeRow[]
  subgraph: GraphEdgeRow[]
  timeline?: GraphEdgeRow[]
  nodes: GraphNodeRow[]
}

export interface RecallRelationsOptions {
  vaultName: string
  entity: string
  mode: 'network' | 'timeline'
  depth?: 1 | 2
  embedQuery?: (text: string) => Promise<number[] | null>
}

/**
 * GraphRAG: name/vector anchor → traverse 1–2 hops or timeline by validFrom.
 * Defaults to approved-only edges/nodes so pending review never reaches the Agent.
 */
export class GraphRagService {
  constructor(private readonly repo: GraphRepository) {}

  async recallRelations(opts: RecallRelationsOptions): Promise<GraphRagResult> {
    const entity = opts.entity.trim()
    if (!entity) {
      return { anchors: [], subgraph: [], nodes: [] }
    }

    const anchors = await this.resolveAnchors(opts.vaultName, entity, opts.embedQuery)
    if (anchors.length === 0) {
      return { anchors: [], subgraph: [], nodes: [] }
    }

    if (opts.mode === 'timeline') {
      const center = anchors[0]!
      const view = await this.repo.listEntityTimeline(opts.vaultName, center.id, {
        approvedOnly: true
      })
      return {
        anchors: this.filterApprovedNodes(anchors),
        subgraph: view.edges.filter((e) => e.isCurrent),
        timeline: view.edges,
        nodes: view.nodes
      }
    }

    const nodeMap = new Map<string, GraphNodeRow>()
    const edgeMap = new Map<string, GraphEdgeRow>()
    for (const anchor of anchors.slice(0, 5)) {
      const view = await this.repo.traverse(opts.vaultName, anchor.id, opts.depth ?? 2, {
        approvedOnly: true
      })
      for (const n of view.nodes) nodeMap.set(n.id, n)
      for (const e of view.edges) edgeMap.set(e.id, e)
    }

    return {
      anchors: this.filterApprovedNodes(anchors),
      subgraph: [...edgeMap.values()],
      nodes: [...nodeMap.values()]
    }
  }

  private filterApprovedNodes(nodes: GraphNodeRow[]): GraphNodeRow[] {
    return nodes.filter((n) => n.reviewStatus !== 'pending' && n.reviewStatus !== 'rejected')
  }

  private async resolveAnchors(
    vaultName: string,
    entity: string,
    embedQuery?: (text: string) => Promise<number[] | null>
  ): Promise<GraphNodeRow[]> {
    const byName = (await this.repo.searchNodesByName(vaultName, entity, { limit: 8 })).filter(
      (n) => n.reviewStatus !== 'pending' && n.reviewStatus !== 'rejected'
    )
    if (byName.length > 0) return byName

    if (embedQuery) {
      try {
        const vector = await embedQuery(entity)
        if (vector?.length) {
          const hits = await this.repo.searchNodesByVector(vaultName, vector, 5)
          return hits
            .map(({ distance: _d, ...row }) => row)
            .filter((n) => n.reviewStatus !== 'pending' && n.reviewStatus !== 'rejected')
        }
      } catch {
        // optional
      }
    }
    return []
  }
}
