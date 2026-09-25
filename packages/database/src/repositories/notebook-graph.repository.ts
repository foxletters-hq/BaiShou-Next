import type { AppDatabase } from '../types'
import type { NotebookGraphRepositoryPort } from './notebook-graph.ports'
import { NotebookGraphEmbedOps } from './notebook-graph.repository.embed'
import { NotebookGraphMutateOps } from './notebook-graph.repository.mutate'
import { NotebookGraphQueryOps } from './notebook-graph.repository.query'

export class NotebookGraphRepository implements NotebookGraphRepositoryPort {
  private readonly query: NotebookGraphQueryOps
  private readonly mutate: NotebookGraphMutateOps
  private readonly embed: NotebookGraphEmbedOps

  constructor(db: AppDatabase) {
    this.query = new NotebookGraphQueryOps(db)
    this.mutate = new NotebookGraphMutateOps(db, this.query)
    this.embed = new NotebookGraphEmbedOps(db)
  }

  getView(...args: Parameters<NotebookGraphQueryOps['getView']>) {
    return this.query.getView(...args)
  }

  searchNodes(...args: Parameters<NotebookGraphQueryOps['searchNodes']>) {
    return this.query.searchNodes(...args)
  }

  getEdgeById(...args: Parameters<NotebookGraphQueryOps['getEdgeById']>) {
    return this.query.getEdgeById(...args)
  }

  listPendingNodes(...args: Parameters<NotebookGraphQueryOps['listPendingNodes']>) {
    return this.query.listPendingNodes(...args)
  }

  listPendingEdges(...args: Parameters<NotebookGraphQueryOps['listPendingEdges']>) {
    return this.query.listPendingEdges(...args)
  }

  getNodeById(...args: Parameters<NotebookGraphQueryOps['getNodeById']>) {
    return this.query.getNodeById(...args)
  }

  listEdgesTouching(...args: Parameters<NotebookGraphQueryOps['listEdgesTouching']>) {
    return this.query.listEdgesTouching(...args)
  }

  findNodesByNameOrAlias(...args: Parameters<NotebookGraphQueryOps['findNodesByNameOrAlias']>) {
    return this.query.findNodesByNameOrAlias(...args)
  }

  findNodeByName(...args: Parameters<NotebookGraphQueryOps['findNodeByName']>) {
    return this.query.findNodeByName(...args)
  }

  getNeighborhood(...args: Parameters<NotebookGraphQueryOps['getNeighborhood']>) {
    return this.query.getNeighborhood(...args)
  }

  findShortestPath(...args: Parameters<NotebookGraphQueryOps['findShortestPath']>) {
    return this.query.findShortestPath(...args)
  }

  listLiveIds(...args: Parameters<NotebookGraphQueryOps['listLiveIds']>) {
    return this.query.listLiveIds(...args)
  }

  applyRawNode(...args: Parameters<NotebookGraphMutateOps['applyRawNode']>) {
    return this.mutate.applyRawNode(...args)
  }

  applyRawEdge(...args: Parameters<NotebookGraphMutateOps['applyRawEdge']>) {
    return this.mutate.applyRawEdge(...args)
  }

  softDeleteNode(...args: Parameters<NotebookGraphMutateOps['softDeleteNode']>) {
    return this.mutate.softDeleteNode(...args)
  }

  remapEdgeEndpoints(...args: Parameters<NotebookGraphMutateOps['remapEdgeEndpoints']>) {
    return this.mutate.remapEdgeEndpoints(...args)
  }

  softDeleteEdge(...args: Parameters<NotebookGraphMutateOps['softDeleteEdge']>) {
    return this.mutate.softDeleteEdge(...args)
  }

  supersedeAiEdgesBySourcePrefix(
    ...args: Parameters<NotebookGraphMutateOps['supersedeAiEdgesBySourcePrefix']>
  ) {
    return this.mutate.supersedeAiEdgesBySourcePrefix(...args)
  }

  deleteAllForNotebook(...args: Parameters<NotebookGraphMutateOps['deleteAllForNotebook']>) {
    return this.mutate.deleteAllForNotebook(...args)
  }

  deleteAllForVault(...args: Parameters<NotebookGraphMutateOps['deleteAllForVault']>) {
    return this.mutate.deleteAllForVault(...args)
  }

  deleteEdgesBySourcePrefix(
    ...args: Parameters<NotebookGraphMutateOps['deleteEdgesBySourcePrefix']>
  ) {
    return this.mutate.deleteEdgesBySourcePrefix(...args)
  }

  updateNodeEmbedding(...args: Parameters<NotebookGraphEmbedOps['updateNodeEmbedding']>) {
    return this.embed.updateNodeEmbedding(...args)
  }

  listUnembeddedLiveNodes(...args: Parameters<NotebookGraphEmbedOps['listUnembeddedLiveNodes']>) {
    return this.embed.listUnembeddedLiveNodes(...args)
  }

  searchNodesByVector(...args: Parameters<NotebookGraphEmbedOps['searchNodesByVector']>) {
    return this.embed.searchNodesByVector(...args)
  }

  clearNodeEmbedding(...args: Parameters<NotebookGraphEmbedOps['clearNodeEmbedding']>) {
    return this.embed.clearNodeEmbedding(...args)
  }
}
