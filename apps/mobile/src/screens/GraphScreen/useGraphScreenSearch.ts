import { useCallback, useEffect, useState } from 'react'
import {
  clampGraphFocusDepth,
  GRAPH_FOCUS_DEPTH_STORAGE_KEY,
  type GraphFocusDepth,
  type GraphSearchMode
} from '@baishou/shared'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  mobileGetNode,
  mobileGetView,
  mobileSearchGraphNodes
} from '@/src/services/mobile-graph.service'
import {
  filterGraphSearchHits,
  findGraphScreenNode,
  graphSearchErrorCopy,
  graphSearchHitViewState
} from './graph-screen-derive.util'
import { viewDepthFor } from './graph-screen-view.util'
import type { GraphScreenTab, GraphScreenTranslateFn } from './graph-screen.types'

type SearchDeps = {
  t: GraphScreenTranslateFn
  toast: { showError: (message: string) => void }
  vaultId: string
  services: { settingsManager?: unknown } | null
  graphNodes: any[]
  pendingNodes: any[]
  setTab: (tab: GraphScreenTab) => void
  setStatus: (status: string) => void
}

export function useGraphScreenSearch(deps: SearchDeps) {
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<GraphSearchMode>('text')
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [localView, setLocalView] = useState<{ nodes: any[]; edges: any[] } | null>(null)
  const [pinNeighborhood, setPinNeighborhood] = useState(false)
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<Set<string>>(() => new Set())
  const [locateIds, setLocateIds] = useState<string[] | null>(null)
  const [locateSeq, setLocateSeq] = useState(0)
  const [focusDepth, setFocusDepth] = useState<GraphFocusDepth>(1)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(GRAPH_FOCUS_DEPTH_STORAGE_KEY)
        if (cancelled || raw == null) return
        setFocusDepth(clampGraphFocusDepth(JSON.parse(raw)))
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const persistFocusDepth = useCallback((depth: GraphFocusDepth) => {
    const next = clampGraphFocusDepth(depth)
    setFocusDepth(next)
    void AsyncStorage.setItem(GRAPH_FOCUS_DEPTH_STORAGE_KEY, JSON.stringify(next))
    return next
  }, [])

  const onSelectNode = async (id: string, opts?: { locate?: boolean; bypassMonth?: boolean }) => {
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    let depthSetting = focusDepth
    if (opts?.bypassMonth && focusDepth < 2) {
      depthSetting = 2
      persistFocusDepth(2)
    }
    const depth = viewDepthFor(depthSetting)
    const node = await mobileGetNode(runtime.drizzleDb, deps.vaultId, id)
    const view = await mobileGetView(runtime.drizzleDb, deps.vaultId, {
      centerNodeId: id,
      depth
    })
    setSelectedId(id)
    setSelectedNode(node)
    setLocalView(view)
    if (opts?.bypassMonth) setPinNeighborhood(true)
    deps.setTab('graph')
    if (opts?.locate || opts?.bypassMonth) setLocateSeq((n) => n + 1)
  }

  const clearSelectionKeepPin = () => {
    setSelectedId(null)
    setSelectedNode(null)
    setHighlightIds(new Set())
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
  }

  const clearToGlobal = () => {
    setPinNeighborhood(false)
    setLocalView(null)
    setHighlightIds(new Set())
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    setSelectedId(null)
    setSelectedNode(null)
  }

  const resetViewForMonthChange = () => {
    setPinNeighborhood(false)
    setLocalView(null)
    setHighlightIds(new Set())
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    setSelectedId(null)
    setSelectedNode(null)
  }

  const locatePendingNode = (id: string) => {
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    setHighlightIds(new Set())
    void onSelectNode(id, { locate: true, bypassMonth: true })
  }

  const locatePendingEdge = async (edge: {
    id: string
    fromId: string
    toId: string
    edgeType?: string
    reviewStatus?: string
  }) => {
    const runtime = getAgentDbRuntime()
    const from =
      deps.graphNodes.find((n) => n.id === edge.fromId) ||
      deps.pendingNodes.find((n) => n.id === edge.fromId) ||
      (runtime?.drizzleDb
        ? await mobileGetNode(runtime.drizzleDb, deps.vaultId, edge.fromId)
        : null)
    const to =
      deps.graphNodes.find((n) => n.id === edge.toId) ||
      deps.pendingNodes.find((n) => n.id === edge.toId) ||
      (runtime?.drizzleDb ? await mobileGetNode(runtime.drizzleDb, deps.vaultId, edge.toId) : null)
    if (!from && !to) return
    if (!from || !to) {
      const only = (from || to) as { id: string }
      void onSelectNode(only.id, { locate: true, bypassMonth: true })
      return
    }
    setSelectedId(null)
    setSelectedNode(null)
    setHighlightIds(new Set([from.id, to.id]))
    setHighlightedEdgeIds(new Set([edge.id]))
    setLocateIds([from.id, to.id])
    setLocalView({ nodes: [from, to], edges: [edge] })
    setPinNeighborhood(true)
    deps.setTab('graph')
    setLocateSeq((n) => n + 1)
  }

  const applySearchHits = (found: any[]) => {
    const list = filterGraphSearchHits(found)
    setHits(list)
    const next = graphSearchHitViewState(list)
    setHighlightIds(new Set(next.highlightIds))
    setHighlightedEdgeIds(new Set())
    setSelectedId(null)
    setSelectedNode(null)
    if (next.localView == null) {
      setLocalView(null)
      setPinNeighborhood(false)
      setLocateIds(null)
      return
    }
    setLocalView(next.localView)
    setPinNeighborhood(true)
    setLocateIds(next.locateIds)
    setLocateSeq((n) => n + 1)
  }

  const onSearch = async (nextMode: GraphSearchMode = searchMode) => {
    const runtime = getAgentDbRuntime()
    const q = query.trim()
    if (!runtime?.drizzleDb || !q) {
      applySearchHits([])
      return
    }
    setSearching(true)
    try {
      const found = await mobileSearchGraphNodes(runtime.drizzleDb, deps.vaultId, q, {
        mode: nextMode,
        settingsManager: deps.services?.settingsManager as never
      })
      applySearchHits(found)
    } catch (error) {
      applySearchHits([])
      const copy = graphSearchErrorCopy(error)
      const message = 'key' in copy ? deps.t(copy.key, copy.fallback) : copy.raw
      deps.setStatus(message)
      deps.toast.showError(message)
    } finally {
      setSearching(false)
    }
  }

  const onSearchHitPress = async (item: any) => {
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    deps.setTab('graph')
    setSelectedId(item.id)
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    setHighlightIds(new Set([item.id]))
    const view = await mobileGetView(runtime.drizzleDb, deps.vaultId, {
      centerNodeId: item.id,
      depth: viewDepthFor(focusDepth)
    })
    setLocalView(view)
    setPinNeighborhood(true)
    const node = await mobileGetNode(runtime.drizzleDb, deps.vaultId, item.id)
    setSelectedNode(node || item)
    setLocateSeq((n) => n + 1)
  }

  const updateFocusDepth = useCallback(
    (depth: GraphFocusDepth) => {
      const next = persistFocusDepth(depth)
      if (pinNeighborhood && selectedId) {
        void (async () => {
          const runtime = getAgentDbRuntime()
          if (!runtime?.drizzleDb) return
          const view = await mobileGetView(runtime.drizzleDb, deps.vaultId, {
            centerNodeId: selectedId,
            depth: viewDepthFor(next)
          })
          setLocalView(view)
          setLocateSeq((n) => n + 1)
        })()
      }
    },
    [persistFocusDepth, pinNeighborhood, selectedId, deps.vaultId]
  )

  const findGraphNode = (id: string) => findGraphScreenNode(id, deps.graphNodes, deps.pendingNodes)

  return {
    query,
    setQuery,
    searchMode,
    setSearchMode,
    searching,
    hits,
    selectedId,
    setSelectedId,
    selectedNode,
    setSelectedNode,
    localView,
    setLocalView,
    pinNeighborhood,
    setPinNeighborhood,
    highlightIds,
    setHighlightIds,
    highlightedEdgeIds,
    setHighlightedEdgeIds,
    locateIds,
    setLocateIds,
    locateSeq,
    setLocateSeq,
    focusDepth,
    persistFocusDepth,
    updateFocusDepth,
    onSelectNode,
    clearSelectionKeepPin,
    clearToGlobal,
    resetViewForMonthChange,
    locatePendingNode,
    locatePendingEdge,
    applySearchHits,
    onSearch,
    onSearchHitPress,
    findGraphNode
  }
}
