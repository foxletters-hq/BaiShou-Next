import { Alert } from 'react-native'
import {
  applyGraphLocalEdgeDelete,
  applyGraphLocalNodeDelete,
  restoreGraphLocalEdgeDelete,
  restoreGraphLocalNodeDelete
} from '@baishou/shared'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import { mobileSoftDeleteGraph } from '@/src/services/mobile-graph.service'
import type { GraphScreenTranslateFn } from './graph-screen.types'

export type GraphScreenDetailDeleteDeps = {
  t: GraphScreenTranslateFn
  toast: { showSuccess: (message: string) => void; showError: (message: string) => void }
  services: { pathService: unknown; fileSystem: unknown } | null
  vaultId: string
  selectedId: string | null
  selectedNode: any | null
  setSelectedId: (id: string | null) => void
  setSelectedNode: (node: any | null) => void
  setLocalView: (view: any) => void
  setPinNeighborhood: (pin: boolean) => void
  setHighlightIds: (ids: Set<string>) => void
  setHighlightedEdgeIds: (ids: Set<string>) => void
  setLocateIds: (ids: string[] | null) => void
  setStatus: (status: string) => void
  graphNodes: any[]
  graphEdges: any[]
  pendingNodes: any[]
  pendingEdges: any[]
  pendingSelected: Set<string>
  setGraphNodes: (nodes: any[]) => void
  setGraphEdges: (edges: any[]) => void
  setPendingNodes: (nodes: any[]) => void
  setPendingEdges: (edges: any[]) => void
  setPendingSelected: (selected: Set<string>) => void
  highlightIds: Set<string>
  highlightedEdgeIds: Set<string>
  locateIds: string[] | null
  localView: { nodes: any[]; edges: any[] } | null
  pinNeighborhood: boolean
  inFlightDeletedNodeIdsRef: { current: Set<string> }
  inFlightDeletedEdgeIdsRef: { current: Set<string> }
  graphViewRef: { current: any }
}

/** 详情页节点/边删除：先改本地视图，失败再按快照撤回。 */
export function useGraphScreenDetailDelete(deps: GraphScreenDetailDeleteDeps) {
  const deleteSelected = () => {
    if (!deps.selectedNode) return
    Alert.alert(
      deps.t('graph.delete_node', '删除节点'),
      deps.t('graph.confirm_delete_node', '确定删除该节点？相关边也会一并删除。'),
      [
        { text: deps.t('common.cancel', '取消'), style: 'cancel' },
        {
          text: deps.t('common.delete', '删除'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!deps.services) return
              const runtime = getAgentDbRuntime()
              if (!runtime?.drizzleDb) return
              const nodeId = deps.selectedNode.id
              const snapshot = {
                graphNodes: deps.graphNodes,
                graphEdges: deps.graphEdges,
                pendingNodes: deps.pendingNodes,
                pendingEdges: deps.pendingEdges,
                pendingSelected: deps.pendingSelected,
                highlightIds: deps.highlightIds,
                highlightedEdgeIds: deps.highlightedEdgeIds,
                locateIds: deps.locateIds,
                localView: deps.localView,
                selectedId: deps.selectedId,
                selectedNode: deps.selectedNode,
                pinNeighborhood: deps.pinNeighborhood
              }
              const next = applyGraphLocalNodeDelete({
                nodeId,
                nodes: deps.graphNodes,
                edges: deps.graphEdges,
                pendingNodes: deps.pendingNodes,
                pendingEdges: deps.pendingEdges,
                pendingSelected: deps.pendingSelected,
                highlightIds: deps.highlightIds,
                highlightedEdgeIds: deps.highlightedEdgeIds,
                locateIds: deps.locateIds,
                localView: deps.localView
              })
              deps.setGraphNodes(next.nodes)
              deps.setGraphEdges(next.edges)
              deps.setPendingNodes(next.pendingNodes)
              deps.setPendingEdges(next.pendingEdges)
              deps.setPendingSelected(next.pendingSelected)
              deps.setHighlightIds(next.highlightIds)
              deps.setHighlightedEdgeIds(next.highlightedEdgeIds)
              deps.setLocateIds(next.locateIds && next.locateIds.length > 0 ? next.locateIds : null)
              deps.setLocalView(next.localView)
              deps.setSelectedNode(null)
              deps.setSelectedId(null)
              deps.setPinNeighborhood(false)
              deps.inFlightDeletedNodeIdsRef.current.add(nodeId)
              for (const edge of snapshot.graphEdges) {
                if (edge.fromId === nodeId || edge.toId === nodeId) {
                  deps.inFlightDeletedEdgeIdsRef.current.add(edge.id)
                }
              }
              deps.toast.showSuccess(deps.t('graph.node_deleted', '已删除节点'))
              void mobileSoftDeleteGraph({
                drizzleDb: runtime.drizzleDb,
                pathService: deps.services.pathService as never,
                fileSystem: deps.services.fileSystem as never,
                kind: 'node',
                id: nodeId,
                vaultId: deps.vaultId
              }).then(
                () => {
                  deps.inFlightDeletedNodeIdsRef.current.delete(nodeId)
                  for (const edge of snapshot.graphEdges) {
                    if (edge.fromId === nodeId || edge.toId === nodeId) {
                      deps.inFlightDeletedEdgeIdsRef.current.delete(edge.id)
                    }
                  }
                },
                (e: unknown) => {
                  deps.inFlightDeletedNodeIdsRef.current.delete(nodeId)
                  for (const edge of snapshot.graphEdges) {
                    if (edge.fromId === nodeId || edge.toId === nodeId) {
                      deps.inFlightDeletedEdgeIdsRef.current.delete(edge.id)
                    }
                  }
                  const restored = restoreGraphLocalNodeDelete({
                    nodeId,
                    current: deps.graphViewRef.current,
                    before: {
                      nodes: snapshot.graphNodes,
                      edges: snapshot.graphEdges,
                      pendingNodes: snapshot.pendingNodes,
                      pendingEdges: snapshot.pendingEdges,
                      localView: snapshot.localView
                    }
                  })
                  deps.setGraphNodes(restored.nodes)
                  deps.setGraphEdges(restored.edges)
                  deps.setPendingNodes(restored.pendingNodes)
                  deps.setPendingEdges(restored.pendingEdges)
                  deps.setLocalView(restored.localView)
                  const message = e instanceof Error ? e.message : String(e)
                  deps.setStatus(message)
                  deps.toast.showError(message)
                }
              )
            })()
          }
        }
      ]
    )
  }

  const deleteEdge = (edgeId: string) => {
    Alert.alert(
      deps.t('graph.delete_edge', '删除'),
      deps.t('graph.confirm_delete_edge', '确定删除这条关系？'),
      [
        { text: deps.t('common.cancel', '取消'), style: 'cancel' },
        {
          text: deps.t('common.delete', '删除'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!deps.services) return
              const runtime = getAgentDbRuntime()
              if (!runtime?.drizzleDb) return
              const snapshot = {
                graphEdges: deps.graphEdges,
                pendingEdges: deps.pendingEdges,
                pendingSelected: deps.pendingSelected,
                highlightedEdgeIds: deps.highlightedEdgeIds,
                localView: deps.localView
              }
              const next = applyGraphLocalEdgeDelete({
                edgeId,
                edges: deps.graphEdges,
                pendingEdges: deps.pendingEdges,
                pendingSelected: deps.pendingSelected,
                highlightedEdgeIds: deps.highlightedEdgeIds,
                localView: deps.localView
              })
              deps.setGraphEdges(next.edges)
              deps.setPendingEdges(next.pendingEdges)
              deps.setPendingSelected(next.pendingSelected)
              deps.setHighlightedEdgeIds(next.highlightedEdgeIds)
              deps.setLocalView(next.localView)
              deps.inFlightDeletedEdgeIdsRef.current.add(edgeId)
              deps.toast.showSuccess(deps.t('graph.edge_deleted', '已删除关系'))
              void mobileSoftDeleteGraph({
                drizzleDb: runtime.drizzleDb,
                pathService: deps.services.pathService as never,
                fileSystem: deps.services.fileSystem as never,
                kind: 'edge',
                id: edgeId,
                vaultId: deps.vaultId
              }).then(
                () => {
                  deps.inFlightDeletedEdgeIdsRef.current.delete(edgeId)
                },
                (e: unknown) => {
                  deps.inFlightDeletedEdgeIdsRef.current.delete(edgeId)
                  const restored = restoreGraphLocalEdgeDelete({
                    edgeId,
                    current: deps.graphViewRef.current,
                    before: {
                      edges: snapshot.graphEdges,
                      pendingEdges: snapshot.pendingEdges,
                      localView: snapshot.localView
                    }
                  })
                  deps.setGraphEdges(restored.edges)
                  deps.setPendingEdges(restored.pendingEdges)
                  deps.setLocalView(restored.localView)
                  const message = e instanceof Error ? e.message : String(e)
                  deps.setStatus(message)
                  deps.toast.showError(message)
                }
              )
            })()
          }
        }
      ]
    )
  }

  return { deleteSelected, deleteEdge }
}
