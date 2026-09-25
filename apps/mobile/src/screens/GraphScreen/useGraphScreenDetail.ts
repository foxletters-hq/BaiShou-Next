import { useEffect, useState } from 'react'
import { GRAPH_EDGE_TYPES } from '@baishou/database'
import { isGraphNodeSameNameConflict, type GraphSameNameExisting } from '@baishou/shared'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  parseGraphNodePropsJson,
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
import { mobileListNameCandidates, mobileRevertGraphNodeSplit } from '@/src/services/mobile-graph-split'
import { parseGraphAliasInput, viewDepthFor } from './graph-screen-view.util'
import type { GraphScreenTranslateFn } from './graph-screen.types'
import type { GraphFocusDepth } from '@baishou/shared'
import { useGraphScreenDetailDelete } from './useGraphScreenDetailDelete'

type DetailDeps = {
  t: GraphScreenTranslateFn
  toast: { showSuccess: (message: string) => void; showError: (message: string) => void }
  dialog: { confirm: (message: string, title?: string) => Promise<boolean> }
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

  useEffect(() => {
    if (!deps.selectedNode) return
    setEditName(deps.selectedNode.name || '')
    setEditSummary(deps.selectedNode.summary || '')
    setEditAliases(
      Array.isArray(deps.selectedNode.aliases) ? deps.selectedNode.aliases.join(', ') : ''
    )
    setAddEdgeQuery('')
    setAddEdgeHits([])
    setAddEdgeToId('')
    setAddEdgeType('relates_to')
    setEditNameConflict(null)
  }, [deps.selectedNode])

  useEffect(() => {
    const runtime = getAgentDbRuntime()
    if (!deps.selectedNode || !runtime?.drizzleDb) {
      setEditNameConflict(null)
      return
    }
    const trimmed = editName.trim()
    if (!trimmed || trimmed === String(deps.selectedNode.name || '').trim()) {
      setEditNameConflict(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      void mobileFindNodeByName(
        runtime.drizzleDb,
        deps.vaultId,
        trimmed,
        deps.selectedNode.nodeType
      ).then((hit) => {
        if (cancelled) return
        setEditNameConflict(
          hit && hit.id !== deps.selectedNode.id
            ? { id: hit.id, name: hit.name, nodeType: hit.nodeType, summary: hit.summary }
            : null
        )
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [editName, deps.selectedNode, deps.vaultId])

  useEffect(() => {
    const runtime = getAgentDbRuntime()
    if (!deps.selectedNode || !runtime?.drizzleDb) {
      setSameNameEntities([])
      return
    }
    let cancelled = false
    void mobileListNameCandidates(runtime.drizzleDb, deps.selectedNode.id).then((rows) => {
      if (cancelled) return
      setSameNameEntities(rows)
    })
    return () => {
      cancelled = true
    }
  }, [deps.selectedNode, deps.vaultId])

  const saveNodeEdit = async () => {
    if (!deps.services || !deps.selectedNode) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const name = editName.trim()
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

  const searchAddEdgeTarget = async () => {
    const runtime = getAgentDbRuntime()
    const q = addEdgeQuery.trim()
    if (!runtime?.drizzleDb || !q || !deps.selectedNode) {
      setAddEdgeHits([])
      return
    }
    const found = await mobileSearchGraphNodes(runtime.drizzleDb, deps.vaultId, q)
    setAddEdgeHits((found || []).filter((h: any) => h.id !== deps.selectedNode.id))
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
