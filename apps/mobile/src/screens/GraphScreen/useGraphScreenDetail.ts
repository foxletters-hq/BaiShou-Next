import { useEffect, useRef, useState } from 'react'
import { GRAPH_EDGE_TYPES } from '@baishou/database'
import {
  isGraphNodeSameNameConflict,
  type GraphFocusDepth,
  type GraphSameNameExisting,
  type GraphSearchMode
} from '@baishou/shared'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  graphBareNodeIdForRevert,
  graphRevertSplitStayId,
  type GraphRegisteredSameNameEntity
} from '@/src/services/graph-name-candidates.util'
import {
  mobileFindNodeByName,
  mobileGetNode,
  mobileGetView,
  mobileSearchGraphNodes,
  mobileUpsertEdge,
  mobileUpsertNode
} from '@/src/services/mobile-graph.service'
import {
  mobileListNameCandidates,
  mobileRevertGraphNodeSplit
} from '@/src/services/mobile-graph-split'
import { parseGraphAliasInput, viewDepthFor } from './graph-screen-view.util'
import { graphSearchErrorCopy } from './graph-screen-derive.util'
import type { GraphScreenTranslateFn } from './graph-screen.types'
import { useGraphScreenDetailDelete } from './useGraphScreenDetailDelete'

type DetailDeps = {
  t: GraphScreenTranslateFn
  toast: { showSuccess: (message: string) => void; showError: (message: string) => void }
  dialog: {
    confirm: (
      message: string,
      titleOrOptions?:
        | string
        | { title?: string; confirmText?: string; cancelText?: string; destructive?: boolean }
    ) => Promise<boolean>
  }
  services: { pathService: unknown; fileSystem: unknown } | null
  vaultId: string
  vaultName: string
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
  focusDepth: GraphFocusDepth
  refresh: () => Promise<void>
  onSelectNode: (id: string) => Promise<void> | void
  inFlightDeletedNodeIdsRef: { current: Set<string> }
  inFlightDeletedEdgeIdsRef: { current: Set<string> }
  graphViewRef: { current: any }
}

export function useGraphScreenDetail(deps: DetailDeps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [editNameConflict, setEditNameConflict] = useState<GraphSameNameExisting | null>(null)
  const [sameNameEntities, setSameNameEntities] = useState<GraphRegisteredSameNameEntity[]>([])
  const [editName, setEditName] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editAliases, setEditAliases] = useState('')
  const [addEdgeQuery, setAddEdgeQuery] = useState('')
  const [addEdgeHits, setAddEdgeHits] = useState<any[]>([])
  const [addEdgeToId, setAddEdgeToId] = useState('')
  const [addEdgeType, setAddEdgeType] = useState<string>(GRAPH_EDGE_TYPES[0] ?? 'relates_to')
  const [addEdgeSearchMode, setAddEdgeSearchMode] = useState<GraphSearchMode>('text')
  const [addEdgeSearching, setAddEdgeSearching] = useState(false)
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
      setAddEdgeQuery('')
      setAddEdgeHits([])
      setAddEdgeToId('')
      setAddEdgeType('relates_to')
      setAddEdgeSearchMode('text')
      setAddEdgeSearching(false)
    }
  }, [selectedNodeId, selectedNodeName, selectedNodeSummary, selectedNodeAliases])

  useEffect(() => {
    const runtime = getAgentDbRuntime()
    if (!selectedNodeId || !runtime?.drizzleDb) {
      setEditNameConflict(null)
      return
    }
    const trimmed = editName.trim()
    if (!trimmed || trimmed === selectedNodeName.trim()) {
      setEditNameConflict(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      void mobileFindNodeByName(runtime.drizzleDb, deps.vaultId, trimmed, selectedNodeType).then(
        (hit) => {
          if (cancelled) return
          setEditNameConflict(
            hit && hit.id !== selectedNodeId
              ? { id: hit.id, name: hit.name, nodeType: hit.nodeType, summary: hit.summary }
              : null
          )
        }
      )
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [editName, selectedNodeId, selectedNodeName, selectedNodeType, deps.vaultId])

  useEffect(() => {
    const runtime = getAgentDbRuntime()
    if (!selectedNodeId || !runtime?.drizzleDb) {
      setSameNameEntities([])
      return
    }
    let cancelled = false
    void mobileListNameCandidates(runtime.drizzleDb, selectedNodeId).then((rows) => {
      if (cancelled) return
      setSameNameEntities(rows)
    })
    return () => {
      cancelled = true
    }
  }, [selectedNodeId, selectedNodeName, deps.vaultId])

  const saveNodeEdit = async () => {
    if (!deps.services || !deps.selectedNode) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const name = editName.trim() || String(deps.selectedNode.name || '').trim()
    if (!name) return
    const nameUnchanged = name === String(deps.selectedNode.name || '').trim()
    const hit = nameUnchanged
      ? null
      : editNameConflict ||
        (await mobileFindNodeByName(
          runtime.drizzleDb,
          deps.vaultId,
          name,
          deps.selectedNode.nodeType
        ).then((row) =>
          row && row.id !== deps.selectedNode.id
            ? { id: row.id, name: row.name, nodeType: row.nodeType, summary: row.summary }
            : null
        ))
    if (hit) {
      setEditNameConflict(hit)
      deps.toast.showError(
        deps.t(
          'graph.same_name_save_blocked',
          '已有同名节点「{{name}}」。请先换名，或把它合并过去。',
          { name: hit.name }
        )
      )
      return
    }
    deps.setBusy(true)
    try {
      const result = await mobileUpsertNode({
        drizzleDb: runtime.drizzleDb,
        pathService: deps.services.pathService as never,
        fileSystem: deps.services.fileSystem as never,
        vaultId: deps.vaultId,
        vaultDisplayName: deps.vaultName,
        id: deps.selectedNode.id,
        name,
        nodeType: deps.selectedNode.nodeType,
        aliases: parseGraphAliasInput(editAliases),
        summary: editSummary
      })
      if (isGraphNodeSameNameConflict(result)) {
        setEditNameConflict(result.existing)
        deps.toast.showError(
          deps.t(
            'graph.same_name_save_blocked',
            '已有同名节点「{{name}}」。请先换名，或把它合并过去。',
            { name: result.existing.name }
          )
        )
        return
      }
      deps.setStatus(deps.t('graph.edit_saved', '已保存（手工修正，重抽不会覆盖）'))
      deps.toast.showSuccess(deps.t('graph.edit_saved', '已保存（手工修正，重抽不会覆盖）'))
      await deps.refresh()
      const node = await mobileGetNode(runtime.drizzleDb, deps.vaultId, deps.selectedNode.id)
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
      deps.setStatus(e?.message || String(e))
      deps.toast.showError(e?.message || String(e))
    } finally {
      deps.setBusy(false)
    }
  }

  const revertSplit = async (discriminator: string) => {
    if (!deps.selectedNode || !deps.services) return
    const bareId = graphBareNodeIdForRevert(deps.selectedNode, sameNameEntities)
    if (!bareId) return
    const ok = await deps.dialog.confirm(
      deps.t(
        'graph.revert_split_confirm',
        '确定把「{{label}}」撤回原实体？它的关系会回到原节点，这条登记会删除。',
        { label: discriminator }
      ),
      deps.t('graph.revert_split', '撤回拆分')
    )
    if (!ok) return
    const db = getAgentDbRuntime()?.drizzleDb
    if (!db) return
    deps.setBusy(true)
    try {
      const result = await mobileRevertGraphNodeSplit({
        drizzleDb: db,
        pathService: deps.services.pathService as never,
        fileSystem: deps.services.fileSystem as never,
        vaultId: deps.vaultId,
        vaultName: deps.vaultName,
        bareNodeId: bareId,
        discriminator
      })
      await deps.refresh()
      await deps.onSelectNode(
        graphRevertSplitStayId({
          selectedNodeId: deps.selectedNode.id,
          removedNodeId: result.removedNodeId,
          bareNodeId: bareId
        })
      )
    } catch (e: unknown) {
      deps.toast.showError(e instanceof Error ? e.message : String(e))
    } finally {
      deps.setBusy(false)
    }
  }

  const { deleteSelected, deleteEdge } = useGraphScreenDetailDelete(deps)

  const addEdgeSearchSeqRef = useRef(0)

  const searchAddEdgeTarget = async (
    nextQueryOrMode?: string | GraphSearchMode,
    requestedMode?: GraphSearchMode
  ) => {
    const seq = ++addEdgeSearchSeqRef.current
    let targetQuery = addEdgeQuery
    let targetMode = addEdgeSearchMode
    if (
      typeof nextQueryOrMode === 'string' &&
      (nextQueryOrMode === 'text' || nextQueryOrMode === 'semantic')
    ) {
      targetMode = nextQueryOrMode
    } else if (typeof nextQueryOrMode === 'string') {
      targetQuery = nextQueryOrMode
      if (requestedMode) targetMode = requestedMode
    }
    const runtime = getAgentDbRuntime()
    const q = targetQuery.trim()
    if (!runtime?.drizzleDb || !q || !deps.selectedNode) {
      setAddEdgeHits([])
      setAddEdgeSearching(false)
      return
    }
    setAddEdgeSearching(true)
    try {
      const found = await mobileSearchGraphNodes(runtime.drizzleDb, deps.vaultId, q, {
        mode: targetMode,
        settingsManager: (deps.services as any)?.settingsManager as never
      })
      if (seq !== addEdgeSearchSeqRef.current) return
      setAddEdgeHits((found || []).filter((h: any) => h.id !== deps.selectedNode.id))
    } catch (e: any) {
      if (seq !== addEdgeSearchSeqRef.current) return
      setAddEdgeHits([])
      const copy = graphSearchErrorCopy(e)
      const message = 'key' in copy ? deps.t(copy.key, copy.fallback) : copy.raw
      deps.toast.showError(message)
    } finally {
      if (seq === addEdgeSearchSeqRef.current) {
        setAddEdgeSearching(false)
      }
    }
  }

  const addEdge = async () => {
    if (!deps.services || !deps.selectedNode || !addEdgeToId) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    deps.setBusy(true)
    try {
      await mobileUpsertEdge({
        drizzleDb: runtime.drizzleDb,
        pathService: deps.services.pathService as never,
        fileSystem: deps.services.fileSystem as never,
        vaultId: deps.vaultId,
        vaultDisplayName: deps.vaultName,
        fromId: deps.selectedNode.id,
        toId: addEdgeToId,
        edgeType: addEdgeType
      })
      setAddEdgeToId('')
      setAddEdgeQuery('')
      setAddEdgeHits([])
      deps.setStatus(deps.t('graph.edge_added', '已添加关系'))
      await deps.refresh()
      if (deps.selectedId) {
        const view = await mobileGetView(runtime.drizzleDb, deps.vaultId, {
          centerNodeId: deps.selectedId,
          depth: viewDepthFor(deps.focusDepth)
        })
        deps.setLocalView(view)
      }
    } catch (e: any) {
      deps.setStatus(e?.message || String(e))
    } finally {
      deps.setBusy(false)
    }
  }

  return {
    createOpen,
    setCreateOpen,
    splitOpen,
    setSplitOpen,
    editNameConflict,
    setEditNameConflict,
    sameNameEntities,
    editName,
    setEditName,
    editSummary,
    setEditSummary,
    editAliases,
    setEditAliases,
    addEdgeQuery,
    setAddEdgeQuery,
    addEdgeSearchMode,
    setAddEdgeSearchMode,
    addEdgeSearching,
    addEdgeHits,
    addEdgeToId,
    setAddEdgeToId,
    addEdgeType,
    setAddEdgeType,
    saveNodeEdit,
    revertSplit,
    deleteSelected,
    deleteEdge,
    searchAddEdgeTarget,
    addEdge
  }
}
