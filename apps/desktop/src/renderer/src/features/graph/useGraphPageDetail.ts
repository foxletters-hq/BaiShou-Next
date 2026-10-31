import { useEffect, useRef, useState } from 'react'
import {
  applyGraphLocalEdgeDelete,
  applyGraphLocalNodeDelete,
  isGraphNodeSameNameConflict,
  restoreGraphLocalEdgeDelete,
  restoreGraphLocalNodeDelete,
  type GraphInventorySnapshot,
  type GraphSameNameExisting,
  type GraphSimilarPendingPair
} from '@baishou/shared'
import { findGraphSameNameNode } from './graph-same-name.lookup'
import {
  graphBareNodeIdForRevert,
  graphRevertSplitStayId,
  parseGraphAliasInput
} from './graph-page-view.util'
import { viewDepthFor } from './graph-page-view.util'
import type { GraphFocusDepth } from '@baishou/shared'
import type { GraphNameCandidate } from './graph-page.types'

type DetailDeps = {
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string
  toast: { showSuccess: (message: string) => void; showError: (message: string) => void }
  dialog: { confirm: (message: string, title?: string) => Promise<boolean> }
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
  setBusy: (busy: boolean) => void
  busy: boolean
  nodes: any[]
  edges: any[]
  pendingNodes: any[]
  pendingEdges: any[]
  pendingSelected: Set<string>
  setNodes: (nodes: any[]) => void
  setEdges: (edges: any[]) => void
  setPendingNodes: (nodes: any[]) => void
  setPendingEdges: (edges: any[]) => void
  setPendingSelected: (selected: Set<string>) => void
  highlightIds: Set<string>
  highlightedEdgeIds: Set<string>
  locateIds: string[] | null
  localView: { nodes: any[]; edges: any[] } | null
  pinNeighborhood: boolean
  focusDepth: GraphFocusDepth
  refresh: () => Promise<void>
  onSelectNode: (id: string) => Promise<void> | void
  inFlightDeletedNodeIdsRef: { current: Set<string> }
  inFlightDeletedEdgeIdsRef: { current: Set<string> }
  graphViewRef: { current: any }
  similarPairs?: GraphSimilarPendingPair[]
  setSimilarPairs?: (pairs: GraphSimilarPendingPair[]) => void
  inventory?: {
    snapshot: () => GraphInventorySnapshot
    applyLocalNodeDelete: (nodeId: string, deletedEdgeCount?: number) => void
    applyLocalEdgeDelete: (deletedEdgeCount?: number) => void
    restoreSnapshot: (snap: GraphInventorySnapshot) => void
    reloadSilent: () => Promise<void>
  }
  removeNodeFromSearchHits?: (nodeId: string) => void
  onAfterDeleteNode?: () => void
}

export function useGraphPageDetail(deps: DetailDeps) {
  const [nameCandidates, setNameCandidates] = useState<GraphNameCandidate[]>([])
  const [editNameConflict, setEditNameConflict] = useState<GraphSameNameExisting | null>(null)
  const [editName, setEditName] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editAliases, setEditAliases] = useState('')
  const [addEdgeToId, setAddEdgeToId] = useState('')
  const [addEdgeType, setAddEdgeType] = useState('relates_to')
  const [addEdgeQuery, setAddEdgeQuery] = useState('')
  const [addEdgeHits, setAddEdgeHits] = useState<any[]>([])
  const [edgeTypes, setEdgeTypes] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const syncedNodeSnapshotRef = useRef<{
    id: string
    name: string
    summary: string
    aliases: string
  } | null>(null)

  const selectedNodeId = deps.selectedNode?.id ? String(deps.selectedNode.id) : null
  const selectedNodeName = String(deps.selectedNode?.name || '')
  const selectedNodeSummary = String(deps.selectedNode?.summary || '')
  const selectedNodeAliases = Array.isArray(deps.selectedNode?.aliases)
    ? deps.selectedNode.aliases.join(', ')
    : ''
  const selectedNodeType = deps.selectedNode?.nodeType
    ? String(deps.selectedNode.nodeType)
    : undefined

  useEffect(() => {
    if (!selectedNodeId) {
      syncedNodeSnapshotRef.current = null
      return
    }
    const prev = syncedNodeSnapshotRef.current
    const isNewSelection = !prev || prev.id !== selectedNodeId
    const persistedFieldsChanged =
      !prev ||
      prev.name !== selectedNodeName ||
      prev.summary !== selectedNodeSummary ||
      prev.aliases !== selectedNodeAliases

    if (!isNewSelection && !persistedFieldsChanged) return

    syncedNodeSnapshotRef.current = {
      id: selectedNodeId,
      name: selectedNodeName,
      summary: selectedNodeSummary,
      aliases: selectedNodeAliases
    }
    setEditName(selectedNodeName)
    setEditSummary(selectedNodeSummary)
    setEditAliases(selectedNodeAliases)
    setEditNameConflict(null)
    if (isNewSelection) {
      setAddEdgeToId('')
      setAddEdgeType('relates_to')
      setAddEdgeQuery('')
      setAddEdgeHits([])
    }
  }, [selectedNodeId, selectedNodeName, selectedNodeSummary, selectedNodeAliases])

  useEffect(() => {
    if (!selectedNodeId) {
      setEditNameConflict(null)
      return
    }
    const trimmed = editName.trim()
    if (!trimmed || trimmed === selectedNodeName.trim()) {
      setEditNameConflict(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void findGraphSameNameNode({
        name: trimmed,
        nodeType: selectedNodeType,
        exceptId: selectedNodeId
      })
        .then((hit) => {
          if (!cancelled) setEditNameConflict(hit)
        })
        .catch(() => {
          if (!cancelled) setEditNameConflict(null)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [editName, selectedNodeId, selectedNodeName, selectedNodeType])

  useEffect(() => {
    if (!selectedNodeId) {
      setNameCandidates([])
      return
    }
    let cancelled = false
    void window.api.graph
      .listNameCandidates({ nodeId: selectedNodeId })
      .then((rows) => {
        if (!cancelled) setNameCandidates(rows)
      })
      .catch(() => {
        if (!cancelled) setNameCandidates([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedNodeId, selectedNodeName])

  const saveNodeEdit = async () => {
    if (!deps.selectedNode) return
    const name = editName.trim() || deps.selectedNode.name
    const hit =
      editNameConflict ||
      (await findGraphSameNameNode({
        name,
        nodeType: deps.selectedNode.nodeType,
        exceptId: deps.selectedNode.id
      }))
    if (hit) {
      setEditNameConflict(hit)
      deps.toast.showError(
        deps.t(
          'graph.same_name_save_blocked',
          '已有同名节点「{{name}}」。请先换名，或把它合并过去。',
          {
            name: hit.name
          }
        )
      )
      return
    }
    deps.setBusy(true)
    try {
      const aliases = parseGraphAliasInput(editAliases)
      const result = await window.api.graph.upsertNode({
        id: deps.selectedNode.id,
        name,
        nodeType: deps.selectedNode.nodeType,
        aliases,
        summary: editSummary
      })
      if (isGraphNodeSameNameConflict(result)) {
        setEditNameConflict(result.existing)
        deps.toast.showError(
          deps.t(
            'graph.same_name_save_blocked',
            '已有同名节点「{{name}}」。请先换名，或把它合并过去。',
            {
              name: result.existing.name
            }
          )
        )
        return
      }
      deps.toast.showSuccess(deps.t('graph.edit_saved', '已保存（手工修正，重抽不会覆盖）'))
      await deps.refresh()
      const node = await window.api.graph.getNode(deps.selectedNode.id)
      deps.setSelectedNode(node)
      if (node) {
        const nextName = String(node.name || '')
        const nextSummary = String(node.summary || '')
        const nextAliases = Array.isArray(node.aliases) ? node.aliases.join(', ') : ''
        syncedNodeSnapshotRef.current = {
          id: String(node.id),
          name: nextName,
          summary: nextSummary,
          aliases: nextAliases
        }
        setEditName(nextName)
        setEditSummary(nextSummary)
        setEditAliases(nextAliases)
        if (deps.localView) {
          deps.setLocalView({
            ...deps.localView,
            nodes: (deps.localView.nodes || []).map((n: any) => (n.id === node.id ? node : n))
          })
        }
      }
    } catch (e: any) {
      const message = e?.message || String(e)
      deps.toast.showError(message)
    } finally {
      deps.setBusy(false)
    }
  }

  const revertSplit = async (discriminator: string) => {
    if (!deps.selectedNode) return
    const bareNodeId = graphBareNodeIdForRevert(deps.selectedNode, nameCandidates)
    if (!bareNodeId) return
    const ok = await deps.dialog.confirm(
      deps.t(
        'graph.revert_split_confirm',
        '确定把「{{label}}」撤回原实体？它的关系会回到原节点，这条登记会删除。',
        {
          label: discriminator
        }
      ),
      deps.t('graph.revert_split', '撤回拆分')
    )
    if (!ok) return
    deps.setBusy(true)
    try {
      const result = await window.api.graph.revertNodeSplit({
        bareNodeId,
        discriminator
      })
      deps.toast.showSuccess(deps.t('graph.revert_split_done', '已撤回拆分'))
      await deps.refresh()
      const stayId = graphRevertSplitStayId({
        selectedNodeId: deps.selectedNode.id,
        removedNodeId: result.removedNodeId,
        bareNodeId
      })
      await deps.onSelectNode(stayId)
    } catch (e: any) {
      deps.toast.showError(e?.message || String(e))
    } finally {
      deps.setBusy(false)
    }
  }

  const deleteSelectedNode = async () => {
    if (!deps.selectedNode) return
    const ok = await deps.dialog.confirm(
      deps.t('graph.confirm_delete_node', '确定删除该节点？相关边也会一并删除。'),
      deps.t('graph.delete_node', '删除节点')
    )
    if (!ok) return
    const nodeId = deps.selectedNode.id
    const inventorySnapshot = deps.inventory?.snapshot()
    const similarSnapshot = deps.similarPairs
    const snapshot = {
      nodes: deps.nodes,
      edges: deps.edges,
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
    const deletedEdgeIds = new Set<string>()
    for (const edge of [...snapshot.edges, ...(snapshot.localView?.edges || [])]) {
      if (edge && (edge.fromId === nodeId || edge.toId === nodeId)) {
        deletedEdgeIds.add(edge.id)
      }
    }
    const next = applyGraphLocalNodeDelete({
      nodeId,
      nodes: deps.nodes,
      edges: deps.edges,
      pendingNodes: deps.pendingNodes,
      pendingEdges: deps.pendingEdges,
      pendingSelected: deps.pendingSelected,
      highlightIds: deps.highlightIds,
      highlightedEdgeIds: deps.highlightedEdgeIds,
      locateIds: deps.locateIds,
      localView: deps.localView
    })
    deps.setNodes(next.nodes)
    deps.setEdges(next.edges)
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
    deps.inventory?.applyLocalNodeDelete(nodeId, deletedEdgeIds.size)
    deps.removeNodeFromSearchHits?.(nodeId)
    if (deps.similarPairs && deps.setSimilarPairs) {
      deps.setSimilarPairs(
        deps.similarPairs.filter((pair) => pair.nodeId !== nodeId && pair.peerId !== nodeId)
      )
    }
    deps.onAfterDeleteNode?.()
    deps.inFlightDeletedNodeIdsRef.current.add(nodeId)
    for (const edgeId of deletedEdgeIds) {
      deps.inFlightDeletedEdgeIdsRef.current.add(edgeId)
    }
    deps.toast.showSuccess(deps.t('graph.node_deleted', '已删除节点'))
    void window.api.graph.softDelete({ kind: 'node', id: nodeId }).then(
      () => {
        deps.inFlightDeletedNodeIdsRef.current.delete(nodeId)
        for (const edgeId of deletedEdgeIds) {
          deps.inFlightDeletedEdgeIdsRef.current.delete(edgeId)
        }
        void deps.inventory?.reloadSilent()
      },
      (e: unknown) => {
        deps.inFlightDeletedNodeIdsRef.current.delete(nodeId)
        for (const edgeId of deletedEdgeIds) {
          deps.inFlightDeletedEdgeIdsRef.current.delete(edgeId)
        }
        const restored = restoreGraphLocalNodeDelete({
          nodeId,
          current: deps.graphViewRef.current,
          before: snapshot
        })
        deps.setNodes(restored.nodes)
        deps.setEdges(restored.edges)
        deps.setPendingNodes(restored.pendingNodes)
        deps.setPendingEdges(restored.pendingEdges)
        deps.setLocalView(restored.localView)
        if (inventorySnapshot) deps.inventory?.restoreSnapshot(inventorySnapshot)
        if (similarSnapshot && deps.setSimilarPairs) deps.setSimilarPairs(similarSnapshot)
        const message = e instanceof Error ? e.message : String(e)
        deps.setStatus(message)
        deps.toast.showError(message)
      }
    )
  }

  const deleteEdge = async (edgeId: string) => {
    const ok = await deps.dialog.confirm(
      deps.t('graph.confirm_delete_edge', '确定删除这条关系？'),
      deps.t('graph.delete_edge', '删除')
    )
    if (!ok) return
    const inventorySnapshot = deps.inventory?.snapshot()
    const snapshot = {
      edges: deps.edges,
      pendingEdges: deps.pendingEdges,
      pendingSelected: deps.pendingSelected,
      highlightedEdgeIds: deps.highlightedEdgeIds,
      localView: deps.localView
    }
    const next = applyGraphLocalEdgeDelete({
      edgeId,
      edges: deps.edges,
      pendingEdges: deps.pendingEdges,
      pendingSelected: deps.pendingSelected,
      highlightedEdgeIds: deps.highlightedEdgeIds,
      localView: deps.localView
    })
    deps.setEdges(next.edges)
    deps.setPendingEdges(next.pendingEdges)
    deps.setPendingSelected(next.pendingSelected)
    deps.setHighlightedEdgeIds(next.highlightedEdgeIds)
    deps.setLocalView(next.localView)
    deps.inventory?.applyLocalEdgeDelete(1)
    deps.inFlightDeletedEdgeIdsRef.current.add(edgeId)
    deps.toast.showSuccess(deps.t('graph.edge_deleted', '已删除关系'))
    void window.api.graph.softDelete({ kind: 'edge', id: edgeId }).then(
      () => {
        deps.inFlightDeletedEdgeIdsRef.current.delete(edgeId)
      },
      (e: unknown) => {
        deps.inFlightDeletedEdgeIdsRef.current.delete(edgeId)
        const restored = restoreGraphLocalEdgeDelete({
          edgeId,
          current: deps.graphViewRef.current,
          before: snapshot
        })
        deps.setEdges(restored.edges)
        deps.setPendingEdges(restored.pendingEdges)
        deps.setLocalView(restored.localView)
        if (inventorySnapshot) deps.inventory?.restoreSnapshot(inventorySnapshot)
        const message = e instanceof Error ? e.message : String(e)
        deps.setStatus(message)
        deps.toast.showError(message)
      }
    )
  }

  const searchAddEdgeTarget = async () => {
    const q = addEdgeQuery.trim()
    if (!q) {
      setAddEdgeHits([])
      return
    }
    const hits = await window.api.graph.search({ query: q, limit: 12 })
    setAddEdgeHits((hits || []).filter((h: any) => h.id !== deps.selectedId))
  }

  const addEdge = async () => {
    if (!deps.selectedId || !addEdgeToId) return
    deps.setBusy(true)
    try {
      await window.api.graph.upsertEdge({
        fromId: deps.selectedId,
        toId: addEdgeToId,
        edgeType: addEdgeType
      })
      setAddEdgeToId('')
      setAddEdgeQuery('')
      setAddEdgeHits([])
      deps.setStatus(deps.t('graph.edge_added', '已添加关系'))
      await deps.refresh()
      const view = await window.api.graph.getView({
        centerNodeId: deps.selectedId,
        depth: viewDepthFor(deps.focusDepth)
      })
      deps.setLocalView(view)
    } catch (e: any) {
      deps.setStatus(e?.message || String(e))
    } finally {
      deps.setBusy(false)
    }
  }

  return {
    nameCandidates,
    editNameConflict,
    editName,
    setEditName,
    editSummary,
    setEditSummary,
    editAliases,
    setEditAliases,
    addEdgeToId,
    setAddEdgeToId,
    addEdgeType,
    setAddEdgeType,
    addEdgeQuery,
    setAddEdgeQuery,
    addEdgeHits,
    edgeTypes,
    setEdgeTypes,
    createOpen,
    setCreateOpen,
    splitOpen,
    setSplitOpen,
    saveNodeEdit,
    revertSplit,
    deleteSelectedNode,
    deleteEdge,
    searchAddEdgeTarget,
    addEdge
  }
}
