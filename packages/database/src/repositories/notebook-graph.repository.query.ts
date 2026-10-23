import type { AppDatabase } from '../types'
import { NotebookGraphLookupOps } from './notebook-graph.repository.query.lookup'
import { NotebookGraphPageOps } from './notebook-graph.repository.query.page'
import { NotebookGraphViewOps } from './notebook-graph.repository.query.view'

/**
 * Notebook 图查询门面：对外保持原有方法集合，
 * 内部按图视图、名称查找、分页统计三块职责拆分。
 */
export class NotebookGraphQueryOps {
  private readonly view: NotebookGraphViewOps
  private readonly lookup: NotebookGraphLookupOps
  private readonly page: NotebookGraphPageOps

  constructor(db: AppDatabase) {
    this.view = new NotebookGraphViewOps(db)
    this.lookup = new NotebookGraphLookupOps(db)
    this.page = new NotebookGraphPageOps(db)
  }

  getView(...args: Parameters<NotebookGraphViewOps['getView']>) {
    return this.view.getView(...args)
  }

  getNeighborhood(...args: Parameters<NotebookGraphViewOps['getNeighborhood']>) {
    return this.view.getNeighborhood(...args)
  }

  findShortestPath(...args: Parameters<NotebookGraphViewOps['findShortestPath']>) {
    return this.view.findShortestPath(...args)
  }

  listLiveIds(...args: Parameters<NotebookGraphViewOps['listLiveIds']>) {
    return this.view.listLiveIds(...args)
  }

  searchNodes(...args: Parameters<NotebookGraphLookupOps['searchNodes']>) {
    return this.lookup.searchNodes(...args)
  }

  getEdgeById(...args: Parameters<NotebookGraphLookupOps['getEdgeById']>) {
    return this.lookup.getEdgeById(...args)
  }

  listPendingNodes(...args: Parameters<NotebookGraphLookupOps['listPendingNodes']>) {
    return this.lookup.listPendingNodes(...args)
  }

  listPendingEdges(...args: Parameters<NotebookGraphLookupOps['listPendingEdges']>) {
    return this.lookup.listPendingEdges(...args)
  }

  listEdgesTouching(...args: Parameters<NotebookGraphLookupOps['listEdgesTouching']>) {
    return this.lookup.listEdgesTouching(...args)
  }

  getNodeById(...args: Parameters<NotebookGraphLookupOps['getNodeById']>) {
    return this.lookup.getNodeById(...args)
  }

  findNodesByNameOrAlias(...args: Parameters<NotebookGraphLookupOps['findNodesByNameOrAlias']>) {
    return this.lookup.findNodesByNameOrAlias(...args)
  }

  findNodeByName(...args: Parameters<NotebookGraphLookupOps['findNodeByName']>) {
    return this.lookup.findNodeByName(...args)
  }

  listNodesPage(...args: Parameters<NotebookGraphPageOps['listNodesPage']>) {
    return this.page.listNodesPage(...args)
  }

  countNodes(...args: Parameters<NotebookGraphPageOps['countNodes']>) {
    return this.page.countNodes(...args)
  }

  countCurrentEdges(...args: Parameters<NotebookGraphPageOps['countCurrentEdges']>) {
    return this.page.countCurrentEdges(...args)
  }
}
