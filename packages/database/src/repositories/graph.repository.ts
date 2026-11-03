import type { AppDatabase } from '../types'
import type { GraphRepositoryPort } from './graph.ports'
import { GraphEmbedOps } from './graph.repository.embed'
import { GraphMutateOps } from './graph.repository.mutate'
import { GraphQueryOps } from './graph.repository.query'
import { GraphReviewOps } from './graph.repository.review'
import { GraphSyncOps } from './graph.repository.sync'
import { GraphTraverseOps } from './graph.repository.traverse'
import { withExpoAgentDatabaseLock } from '../expo-agent-db.lock'
import { runWithSqliteBusyRetry } from '../sqlite-busy.util'

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

  constructor(private readonly database: AppDatabase) {
    this.query = new GraphQueryOps(database)
    this.traverseOps = new GraphTraverseOps(database)
    this.mutate = new GraphMutateOps(database, this.query)
    this.sync = new GraphSyncOps(this.query, this.mutate)
    this.embed = new GraphEmbedOps(database)
    this.review = new GraphReviewOps(database, this.query)
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    return withExpoAgentDatabaseLock(this.database, () => runWithSqliteBusyRetry(fn))
  }

  findNodesByNameOrAlias(...args: Parameters<GraphQueryOps['findNodesByNameOrAlias']>) {
    return this.run(() => this.query.findNodesByNameOrAlias(...args))
  }

  findNodesByNamesOrAliasesBatch(
    ...args: Parameters<GraphQueryOps['findNodesByNamesOrAliasesBatch']>
  ) {
    return this.run(() => this.query.findNodesByNamesOrAliasesBatch(...args))
  }

  findNodeByNameOrAlias(...args: Parameters<GraphQueryOps['findNodeByNameOrAlias']>) {
    return this.run(() => this.query.findNodeByNameOrAlias(...args))
  }

  searchNodesByName(...args: Parameters<GraphQueryOps['searchNodesByName']>) {
    return this.run(() => this.query.searchNodesByName(...args))
  }

  getGlobalGraph(...args: Parameters<GraphQueryOps['getGlobalGraph']>) {
    return this.run(() => this.query.getGlobalGraph(...args))
  }

  listLiveNodesPage(...args: Parameters<GraphQueryOps['listLiveNodesPage']>) {
    return this.run(() => this.query.listLiveNodesPage(...args))
  }

  countLiveNodes(...args: Parameters<GraphQueryOps['countLiveNodes']>) {
    return this.run(() => this.query.countLiveNodes(...args))
  }

  countLiveCurrentEdges(...args: Parameters<GraphQueryOps['countLiveCurrentEdges']>) {
    return this.run(() => this.query.countLiveCurrentEdges(...args))
  }

  getNodesByIds(...args: Parameters<GraphQueryOps['getNodesByIds']>) {
    return this.run(() => this.query.getNodesByIds(...args))
  }

  getNodeById(...args: Parameters<GraphQueryOps['getNodeById']>) {
    return this.run(() => this.query.getNodeById(...args))
  }

  getEdgeById(...args: Parameters<GraphQueryOps['getEdgeById']>) {
    return this.run(() => this.query.getEdgeById(...args))
  }

  listEdgesTouching(...args: Parameters<GraphQueryOps['listEdgesTouching']>) {
    return this.run(() => this.query.listEdgesTouching(...args))
  }

  listNodeIds(...args: Parameters<GraphQueryOps['listNodeIds']>) {
    return this.run(() => this.query.listNodeIds(...args))
  }

  listEdgeIds(...args: Parameters<GraphQueryOps['listEdgeIds']>) {
    return this.run(() => this.query.listEdgeIds(...args))
  }

  listLiveNodeRefs(...args: Parameters<GraphQueryOps['listLiveNodeRefs']>) {
    return this.run(() => this.query.listLiveNodeRefs(...args))
  }

  listLiveEdgeRefs(...args: Parameters<GraphQueryOps['listLiveEdgeRefs']>) {
    return this.run(() => this.query.listLiveEdgeRefs(...args))
  }

  traverse(...args: Parameters<GraphTraverseOps['traverse']>) {
    return this.run(() => this.traverseOps.traverse(...args))
  }

  listEntityTimeline(...args: Parameters<GraphTraverseOps['listEntityTimeline']>) {
    return this.run(() => this.traverseOps.listEntityTimeline(...args))
  }

  findShortestPath(...args: Parameters<GraphTraverseOps['findShortestPath']>) {
    return this.run(() => this.traverseOps.findShortestPath(...args))
  }

  findPathsFrom(...args: Parameters<GraphTraverseOps['findPathsFrom']>) {
    return this.run(() => this.traverseOps.findPathsFrom(...args))
  }

  upsertNode(...args: Parameters<GraphMutateOps['upsertNode']>) {
    return this.run(() => this.mutate.upsertNode(...args))
  }

  upsertEdge(...args: Parameters<GraphMutateOps['upsertEdge']>) {
    return this.run(() => this.mutate.upsertEdge(...args))
  }

  supersedeEdge(...args: Parameters<GraphMutateOps['supersedeEdge']>) {
    return this.run(() => this.mutate.supersedeEdge(...args))
  }

  supersedeEdgesBySourceRef(...args: Parameters<GraphMutateOps['supersedeEdgesBySourceRef']>) {
    return this.run(() => this.mutate.supersedeEdgesBySourceRef(...args))
  }

  softDeleteNode(...args: Parameters<GraphMutateOps['softDeleteNode']>) {
    return this.run(() => this.mutate.softDeleteNode(...args))
  }

  remapEdgeEndpoints(...args: Parameters<GraphMutateOps['remapEdgeEndpoints']>) {
    return this.run(() => this.mutate.remapEdgeEndpoints(...args))
  }

  softDeleteEdge(...args: Parameters<GraphMutateOps['softDeleteEdge']>) {
    return this.run(() => this.mutate.softDeleteEdge(...args))
  }

  recountMentions(...args: Parameters<GraphMutateOps['recountMentions']>) {
    return this.run(() => this.mutate.recountMentions(...args))
  }

  deleteAllForVault(...args: Parameters<GraphMutateOps['deleteAllForVault']>) {
    return this.run(() => this.mutate.deleteAllForVault(...args))
  }

  applyRawNode(...args: Parameters<GraphSyncOps['applyRawNode']>) {
    return this.run(() => this.sync.applyRawNode(...args))
  }

  applyRawNodesBatch(...args: Parameters<GraphSyncOps['applyRawNodesBatch']>) {
    return this.run(() => this.sync.applyRawNodesBatch(...args))
  }

  applyRawEdge(...args: Parameters<GraphSyncOps['applyRawEdge']>) {
    return this.run(() => this.sync.applyRawEdge(...args))
  }

  applyRawEdgesBatch(...args: Parameters<GraphSyncOps['applyRawEdgesBatch']>) {
    return this.run(() => this.sync.applyRawEdgesBatch(...args))
  }

  searchNodesByVector(...args: Parameters<GraphEmbedOps['searchNodesByVector']>) {
    return this.run(() => this.embed.searchNodesByVector(...args))
  }

  countUnembeddedLiveNodes(...args: Parameters<GraphEmbedOps['countUnembeddedLiveNodes']>) {
    return this.run(() => this.embed.countUnembeddedLiveNodes(...args))
  }

  listEmbeddedLiveNodesPage(...args: Parameters<GraphEmbedOps['listEmbeddedLiveNodesPage']>) {
    return this.run(() => this.embed.listEmbeddedLiveNodesPage(...args))
  }

  countEmbeddedLiveNodes(...args: Parameters<GraphEmbedOps['countEmbeddedLiveNodes']>) {
    return this.run(() => this.embed.countEmbeddedLiveNodes(...args))
  }

  clearNodeEmbedding(...args: Parameters<GraphEmbedOps['clearNodeEmbedding']>) {
    return this.run(() => this.embed.clearNodeEmbedding(...args))
  }

  listUnembeddedLiveNodes(...args: Parameters<GraphEmbedOps['listUnembeddedLiveNodes']>) {
    return this.run(() => this.embed.listUnembeddedLiveNodes(...args))
  }

  updateNodeEmbedding(...args: Parameters<GraphEmbedOps['updateNodeEmbedding']>) {
    return this.run(() => this.embed.updateNodeEmbedding(...args))
  }

  updateNodeEmbeddingsBatch(...args: Parameters<GraphEmbedOps['updateNodeEmbeddingsBatch']>) {
    return this.run(() => this.embed.updateNodeEmbeddingsBatch(...args))
  }

  listPendingEdges(...args: Parameters<GraphReviewOps['listPendingEdges']>) {
    return this.run(() => this.review.listPendingEdges(...args))
  }

  listPendingNodes(...args: Parameters<GraphReviewOps['listPendingNodes']>) {
    return this.run(() => this.review.listPendingNodes(...args))
  }

  listSuspectNodes(...args: Parameters<GraphReviewOps['listSuspectNodes']>) {
    return this.run(() => this.review.listSuspectNodes(...args))
  }

  listSimilarPendingPairs(...args: Parameters<GraphReviewOps['listSimilarPendingPairs']>) {
    return this.run(() => this.review.listSimilarPendingPairs(...args))
  }

  listLiveScanGraph(...args: Parameters<GraphReviewOps['listLiveScanGraph']>) {
    return this.run(() => this.review.listLiveScanGraph(...args))
  }

  listPendingGraph(...args: Parameters<GraphReviewOps['listPendingGraph']>) {
    return this.run(() => this.review.listPendingGraph(...args))
  }
}
