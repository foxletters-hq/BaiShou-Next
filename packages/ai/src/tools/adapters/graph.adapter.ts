import {
  resolveExactGraphNodeHit,
  toToolGraphEdgeHit,
  toToolGraphNodeHit,
  type ToolGraphEdgeHit,
  type ToolGraphEdgeLookup,
  type ToolGraphNodeHit,
  type ToolGraphNodeLookup,
  type ToolGraphReader,
  type ToolGraphRagResult,
  type ToolGraphRecallOpts
} from '@baishou/shared'

export type GraphRecallFn = (opts: ToolGraphRecallOpts) => Promise<ToolGraphRagResult>

export type GraphFindNodeFn = (opts: {
  name: string
  nodeType?: string
}) => Promise<ToolGraphNodeHit | null>

export type GraphFindNodesFn = (opts: {
  name: string
  nodeType?: string
}) => Promise<ToolGraphNodeHit[]>

export type GraphFindNodeByIdFn = (id: string) => Promise<ToolGraphNodeHit | null>

export type GraphFindEdgeByIdFn = (id: string) => Promise<ToolGraphEdgeHit | null>

/** Host-injected GraphRAG adapter for recall_relations. */
export class GraphReaderAdapter implements ToolGraphReader {
  constructor(private readonly recall: GraphRecallFn) {}

  async recallRelations(opts: ToolGraphRecallOpts): Promise<ToolGraphRagResult> {
    return this.recall(opts)
  }
}

/** Host-injected exact name / id lookup for graph_upsert. */
export class GraphNodeLookupAdapter implements ToolGraphNodeLookup {
  constructor(
    private readonly findNode: GraphFindNodeFn,
    private readonly findById: GraphFindNodeByIdFn,
    private readonly findNodes?: GraphFindNodesFn
  ) {}

  async findNodeByName(opts: {
    name: string
    nodeType?: string
  }): Promise<ToolGraphNodeHit | null> {
    return this.findNode(opts)
  }

  async findNodesByName(opts: { name: string; nodeType?: string }): Promise<ToolGraphNodeHit[]> {
    if (this.findNodes) return this.findNodes(opts)
    const hit = await this.findNode(opts)
    return hit ? [hit] : []
  }

  async findNodeById(id: string): Promise<ToolGraphNodeHit | null> {
    return this.findById(id)
  }
}

/** Host-injected edge lookup for graph_upsert updates. */
export class GraphEdgeLookupAdapter implements ToolGraphEdgeLookup {
  constructor(private readonly findById: GraphFindEdgeByIdFn) {}

  async findEdgeById(id: string): Promise<ToolGraphEdgeHit | null> {
    return this.findById(id)
  }
}

export type CompanionGraphNodeRow = Parameters<typeof toToolGraphNodeHit>[0]
export type CompanionGraphEdgeRow = Parameters<typeof toToolGraphEdgeHit>[0]

export type CompanionGraphVaultRepo = {
  findByNameOrAlias: (name: string, nodeType?: string) => Promise<CompanionGraphNodeRow | null>
  /** All exact name/alias matches, used to surface ambiguous endpoints. */
  findNodesByNameOrAlias?: (name: string, nodeType?: string) => Promise<CompanionGraphNodeRow[]>
  getNodeById: (id: string) => Promise<CompanionGraphNodeRow | null>
  getEdgeById: (id: string) => Promise<CompanionGraphEdgeRow | null>
}

/**
 * Partner graph_upsert lookups. Both hosts must pass getNodeById and getEdgeById;
 * omitting edge lookup makes in-place edge updates skip.
 */
export function createCompanionGraphLookups(
  loadVaultRepo: () => Promise<CompanionGraphVaultRepo>
): {
  graphNodeLookup: ToolGraphNodeLookup
  graphEdgeLookup: ToolGraphEdgeLookup
} {
  return {
    graphNodeLookup: new GraphNodeLookupAdapter(
      async (opts) => {
        const repo = await loadVaultRepo()
        const hit = await resolveExactGraphNodeHit(opts, {
          findByNameOrAlias: repo.findByNameOrAlias
        })
        return hit ? toToolGraphNodeHit(hit) : null
      },
      async (id) => {
        const repo = await loadVaultRepo()
        const row = await repo.getNodeById(id)
        return row ? toToolGraphNodeHit(row) : null
      },
      async (opts) => {
        const repo = await loadVaultRepo()
        if (!repo.findNodesByNameOrAlias) {
          const hit = await resolveExactGraphNodeHit(opts, {
            findByNameOrAlias: repo.findByNameOrAlias
          })
          return hit ? [toToolGraphNodeHit(hit)] : []
        }
        const rows = await repo.findNodesByNameOrAlias(opts.name, opts.nodeType)
        return rows.map((row) => toToolGraphNodeHit(row))
      }
    ),
    graphEdgeLookup: new GraphEdgeLookupAdapter(async (id) => {
      const repo = await loadVaultRepo()
      const row = await repo.getEdgeById(id)
      return row ? toToolGraphEdgeHit(row) : null
    })
  }
}
