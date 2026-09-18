import type { AppDatabase } from '../types'
import type { GraphRepositoryPort } from './graph.ports'
import { GraphEmbedOps } from './graph.repository.embed'
import { GraphMutateOps } from './graph.repository.mutate'
import { GraphQueryOps } from './graph.repository.query'
import { GraphReviewOps } from './graph.repository.review'
import { GraphSyncOps } from './graph.repository.sync'
import { GraphTraverseOps } from './graph.repository.traverse'

export type {
  ApplyRawNodeResult,
  GraphEdgeRow,
  GraphNodeRow,
  GraphPath,
  UpsertEdgeInput,
  UpsertNodeInput
} from './graph.repository.types'

/**
 * SQLite-only graph repository. Does not write Graph/ JSONL files.
 */
export class GraphRepository implements GraphRepositoryPort {
  private readonly query: GraphQueryOps
  private readonly traverseOps: GraphTraverseOps
  private readonly mutate: GraphMutateOps
  private readonly sync: GraphSyncOps
  private readonly embed: GraphEmbedOps
  private readonly review: GraphReviewOps

  constructor(database: AppDatabase) {
    this.query = new GraphQueryOps(database)
    this.traverseOps = new GraphTraverseOps(database)
    this.mutate = new GraphMutateOps(database, this.query)
    this.sync = new GraphSyncOps(this.query, this.mutate)
    this.embed = new GraphEmbedOps(database)
    this.review = new GraphReviewOps(database, this.query)
  }

  findNodesByNameOrAlias(...args: Parameters<GraphQueryOps['findNodesByNameOrAlias']>) {
    return this.query.findNodesByNameOrAlias(...args)
  }

  findNodeByNameOrAlias(...args: Parameters<GraphQueryOps['findNodeByNameOrAlias']>) {
    return this.query.findNodeByNameOrAlias(...args)
  }

  searchNodesByName(...args: Parameters<GraphQueryOps['searchNodesByName']>) {
    return this.query.searchNodesByName(...args)
  }

  getGlobalGraph(...args: Parameters<GraphQueryOps['getGlobalGraph']>) {
    return this.query.getGlobalGraph(...args)
  }

  getNodesByIds(...args: Parameters<GraphQueryOps['getNodesByIds']>) {
    return this.query.getNodesByIds(...args)
  }

  getNodeById(...args: Parameters<GraphQueryOps['getNodeById']>) {
    return this.query.getNodeById(...args)
  }

  getEdgeById(...args: Parameters<GraphQueryOps['getEdgeById']>) {
    return this.query.getEdgeById(...args)
  }

  listEdgesTouching(...args: Parameters<GraphQueryOps['listEdgesTouching']>) {
    return this.query.listEdgesTouching(...args)
  }

  listNodeIds(...args: Parameters<GraphQueryOps['listNodeIds']>) {
    return this.query.listNodeIds(...args)
  }

  listEdgeIds(...args: Parameters<GraphQueryOps['listEdgeIds']>) {
    return this.query.listEdgeIds(...args)
  }

  listLiveNodeRefs(...args: Parameters<GraphQueryOps['listLiveNodeRefs']>) {
    return this.query.listLiveNodeRefs(...args)
  }

  listLiveEdgeRefs(...args: Parameters<GraphQueryOps['listLiveEdgeRefs']>) {
    return this.query.listLiveEdgeRefs(...args)
  }

  traverse(...args: Parameters<GraphTraverseOps['traverse']>) {
    return this.traverseOps.traverse(...args)
  }

  listEntityTimeline(...args: Parameters<GraphTraverseOps['listEntityTimeline']>) {
    return this.traverseOps.listEntityTimeline(...args)
  }

  findShortestPath(...args: Parameters<GraphTraverseOps['findShortestPath']>) {
    return this.traverseOps.findShortestPath(...args)
  }

  findPathsFrom(...args: Parameters<GraphTraverseOps['findPathsFrom']>) {
    return this.traverseOps.findPathsFrom(...args)
  }

  upsertNode(...args: Parameters<GraphMutateOps['upsertNode']>) {
    return this.mutate.upsertNode(...args)
  }

  upsertEdge(...args: Parameters<GraphMutateOps['upsertEdge']>) {
    return this.mutate.upsertEdge(...args)
  }

  supersedeEdge(...args: Parameters<GraphMutateOps['supersedeEdge']>) {
    return this.mutate.supersedeEdge(...args)
  }

  supersedeEdgesBySourceRef(...args: Parameters<GraphMutateOps['supersedeEdgesBySourceRef']>) {
    return this.mutate.supersedeEdgesBySourceRef(...args)
  }

  softDeleteNode(...args: Parameters<GraphMutateOps['softDeleteNode']>) {
    return this.mutate.softDeleteNode(...args)
  }

  remapEdgeEndpoints(...args: Parameters<GraphMutateOps['remapEdgeEndpoints']>) {
    return this.mutate.remapEdgeEndpoints(...args)
  }

  softDeleteEdge(...args: Parameters<GraphMutateOps['softDeleteEdge']>) {
    return this.mutate.softDeleteEdge(...args)
  }

  recountMentions(...args: Parameters<GraphMutateOps['recountMentions']>) {
    return this.mutate.recountMentions(...args)
  }

  deleteAllForVault(...args: Parameters<GraphMutateOps['deleteAllForVault']>) {
    return this.mutate.deleteAllForVault(...args)
  }

  applyRawNode(...args: Parameters<GraphSyncOps['applyRawNode']>) {
    return this.sync.applyRawNode(...args)
  }

  applyRawEdge(...args: Parameters<GraphSyncOps['applyRawEdge']>) {
    return this.sync.applyRawEdge(...args)
  }

  searchNodesByVector(...args: Parameters<GraphEmbedOps['searchNodesByVector']>) {
    return this.embed.searchNodesByVector(...args)
  }

  countUnembeddedLiveNodes(...args: Parameters<GraphEmbedOps['countUnembeddedLiveNodes']>) {
    return this.embed.countUnembeddedLiveNodes(...args)
  }

  listEmbeddedLiveNodesPage(...args: Parameters<GraphEmbedOps['listEmbeddedLiveNodesPage']>) {
    return this.embed.listEmbeddedLiveNodesPage(...args)
  }

  countEmbeddedLiveNodes(...args: Parameters<GraphEmbedOps['countEmbeddedLiveNodes']>) {
    return this.embed.countEmbeddedLiveNodes(...args)
  }

  clearNodeEmbedding(...args: Parameters<GraphEmbedOps['clearNodeEmbedding']>) {
    return this.embed.clearNodeEmbedding(...args)
  }

  listUnembeddedLiveNodes(...args: Parameters<GraphEmbedOps['listUnembeddedLiveNodes']>) {
    return this.embed.listUnembeddedLiveNodes(...args)
  }

  updateNodeEmbedding(...args: Parameters<GraphEmbedOps['updateNodeEmbedding']>) {
    return this.embed.updateNodeEmbedding(...args)
  }

  listPendingEdges(...args: Parameters<GraphReviewOps['listPendingEdges']>) {
    return this.review.listPendingEdges(...args)
  }

  listPendingNodes(...args: Parameters<GraphReviewOps['listPendingNodes']>) {
    return this.review.listPendingNodes(...args)
  }

  listSuspectNodes(...args: Parameters<GraphReviewOps['listSuspectNodes']>) {
    return this.review.listSuspectNodes(...args)
  }

  listSimilarPendingPairs(...args: Parameters<GraphReviewOps['listSimilarPendingPairs']>) {
    return this.review.listSimilarPendingPairs(...args)
  }

  listLiveScanGraph(...args: Parameters<GraphReviewOps['listLiveScanGraph']>) {
    return this.review.listLiveScanGraph(...args)
  }

  listPendingGraph(...args: Parameters<GraphReviewOps['listPendingGraph']>) {
    return this.review.listPendingGraph(...args)
  }
}
