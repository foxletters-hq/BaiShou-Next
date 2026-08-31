import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { MdArticle, MdChevronLeft, MdChevronRight, MdSettings, MdTune } from 'react-icons/md'
import { Search } from 'lucide-react'
import {
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  type UserGender,
  type UserProfile,
  asGraphTranslateFn,
  translateGraphEdgeType,
  translateGraphNodeType,
  GRAPH_NODE_TYPE_LABEL_FALLBACKS,
  graphNodeTypeColor,
  loadGraphForceSettings,
  saveGraphForceSettings,
  clampGraphForceSettings,
  GRAPH_FORCE_DEFAULTS,
  type GraphForceSettings,
  loadGraphAppearanceSettings,
  saveGraphAppearanceSettings,
  clampGraphAppearanceSettings,
  GRAPH_APPEARANCE_DEFAULTS,
  type GraphAppearanceSettings,
  USER_GENDER_OPTIONS,
  validateGraphAwakenForm,
  isDefaultGraphSelfName,
  loadGraphMonthRange,
  saveGraphMonthRange,
  clampGraphMonthRange,
  defaultGraphMonthRange,
  isDefaultGraphMonthRange,
  formatGraphMonth,
  parseGraphMonthToDate,
  type GraphMonthRange,
  loadGraphFocusDepth,
  saveGraphFocusDepth,
  clampGraphFocusDepth,
  collectGraphFocusIds,
  GRAPH_FOCUS_DEPTH_OPTIONS,
  type GraphFocusDepth,
  GRAPH_EXTRACT_CONCURRENCY_MAX,
  GRAPH_EXTRACT_CONCURRENCY_MIN,
  GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR,
  GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR,
  GRAPH_GLOBAL_MAX_NODES,
  describeGraphExtractPhase,
  describeGraphExtractQueueError,
  emptyGraphExtractQueueSnapshot,
  graphExtractBarPercent,
  graphExtractOverallProgress,
  isGraphExtractBusyStatus,
  isGraphNodeSameNameConflict,
  graphPendingItemKey,
  applyGraphLocalEdgeDelete,
  applyGraphLocalNodeDelete,
  omitInFlightGraphDeletes,
  restoreGraphLocalEdgeDelete,
  restoreGraphLocalNodeDelete,
  splitGraphReviewSelection,
  loadGraphExtractConcurrency,
  normalizeGraphFilePath,
  remapGraphViewReviewForDisplay,
  saveGraphExtractConcurrency,
  type GraphSameNameExisting
} from '@baishou/shared'
import {
  Checkbox,
  HelpTooltip,
  Input,
  MarkdownRenderer,
  Modal,
  Select,
  useDialog,
  useToast
} from '@baishou/ui'
import {
  ensureDesktopGraphSelfName,
  loadDesktopGraphAwakenSelfName,
  saveDesktopGraphAwakenProfile
} from '../diary/utils/ensure-graph-self-name'
import { usePanelResize } from '../agent-workspace/workbench/usePanelResize'
import { GraphAwakenWelcome } from './GraphAwakenWelcome'
import { GraphExtractHelpButton } from './GraphExtractHelpButton'
import { GraphAwakenBirthdayField } from './GraphAwakenBirthdayField'
import { GraphCreateNodeModal } from './GraphCreateNodeModal'
import { GraphCanvasSettingsPanel } from './GraphCanvasSettingsPanel'
import { GraphForceCanvas } from './GraphForceCanvas'
import {
  GraphIrreversibleConfirm,
  type GraphMergeConfirmTarget
} from './GraphIrreversibleConfirm'
import { GraphMergeSearchModal } from './GraphMergeSearchModal'
import { GraphMonthRangePicker } from './GraphMonthRangePicker'
import { findGraphSameNameNode } from './graph-same-name.lookup'
import {
  graphCancelQueueItem,
  graphGetQueueState,
  graphOnQueueProgress,
  graphQueueExtract,
  graphSetExtractConcurrency,
  graphStopExtract,
  type GraphExtractQueueSnapshot
} from './graph-extract-queue.api'
import { MemoryReadinessBar } from '../memory/MemoryReadinessBar'
import { useMemoryReadiness } from '../memory/useMemoryReadiness'
import { SETTINGS_HUB_PREFIX } from '../settings/settings-route.util'
import { useNavigate } from 'react-router-dom'
import styles from './GraphPage.module.css'

type SideTab = 'reextract' | 'pending' | 'detail'
type SideMode = 'ops' | 'content' | 'settings'

const SIDE_WIDTH_KEY = 'baishou.graph.sideWidth.v1'
const SIDE_COLLAPSED_KEY = 'baishou.graph.sideCollapsed.v1'
const SIDE_WIDTH_MIN = 260
const SIDE_WIDTH_MAX = 560
const SIDE_WIDTH_DEFAULT = 320

/** Entity types available in the filter panel (exclude structural diary anchors). */
const GRAPH_FILTER_NODE_TYPES = Object.keys(GRAPH_NODE_TYPE_LABEL_FALLBACKS).filter(
  (t) => t !== 'entry'
)

function loadSideWidth(): number {
  try {
    const n = Number(localStorage.getItem(SIDE_WIDTH_KEY))
    if (Number.isFinite(n)) {
      return Math.min(SIDE_WIDTH_MAX, Math.max(SIDE_WIDTH_MIN, n))
    }
  } catch {
    // ignore
  }
  return SIDE_WIDTH_DEFAULT
}

function loadSideCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDE_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function saveSideCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDE_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // ignore
  }
}

type CostEstimate = {
  entryCount: number
  estimatedTokens: number
  estimatedMinutesLow: number
  estimatedMinutesHigh: number
}

type SourcePreview = {
  date: string | null
  content: string
  excerpt?: string | null
  basePath?: string
  loading: boolean
}

export type GraphPageProps = {
  embedded?: boolean
  highlightStartOrganize?: boolean
}

export const GraphPage: React.FC<GraphPageProps> = ({
  embedded = false,
  highlightStartOrganize = false
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const readiness = useMemoryReadiness()
  const tr = asGraphTranslateFn(t)
  const dialog = useDialog()
  const toast = useToast()
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<Set<string>>(() => new Set())
  const [locateIds, setLocateIds] = useState<string[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [localView, setLocalView] = useState<{ nodes: any[]; edges: any[] } | null>(null)
  /** Pending「查看」：忽略月份切片，画布改用邻域子图。 */
  const [pinNeighborhood, setPinNeighborhood] = useState(false)
  const [pendingReextract, setPendingReextract] = useState<any[]>([])
  const [pendingNodes, setPendingNodes] = useState<any[]>([])
  const [pendingEdges, setPendingEdges] = useState<any[]>([])
  const [pendingSelected, setPendingSelected] = useState<Set<string>>(() => new Set())
  const [mergeSearchOpen, setMergeSearchOpen] = useState(false)
  const [mergeConfirm, setMergeConfirm] = useState<GraphMergeConfirmTarget | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editNameConflict, setEditNameConflict] = useState<GraphSameNameExisting | null>(null)
  const [tab, setTab] = useState<SideTab>('reextract')
  const [sideMode, setSideMode] = useState<SideMode>('ops')
  const [busy, setBusy] = useState(false)
  const [extractRunning, setExtractRunning] = useState(false)
  const [extractConcurrency, setExtractConcurrency] = useState(() => loadGraphExtractConcurrency())
  const [extractQueue, setExtractQueue] = useState<GraphExtractQueueSnapshot | null>(null)
  const [queueModalOpen, setQueueModalOpen] = useState(false)
  const [status, setStatus] = useState('')
  const queueUnsubRef = useRef<(() => void) | null>(null)
  const [hideEntry, setHideEntry] = useState(true)
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<string>>(
    () => new Set(GRAPH_FILTER_NODE_TYPES)
  )
  const [forceSettings, setForceSettings] = useState<GraphForceSettings>(() => loadGraphForceSettings())
  const [appearanceSettings, setAppearanceSettings] = useState<GraphAppearanceSettings>(() =>
    loadGraphAppearanceSettings()
  )
  const [profileSectionOpen, setProfileSectionOpen] = useState(false)
  const [animationTick, setAnimationTick] = useState(0)
  const [locateSeq, setLocateSeq] = useState(0)
  const [sideWidth, setSideWidth] = useState(loadSideWidth)
  const [sideCollapsed, setSideCollapsed] = useState(loadSideCollapsed)
  const sideWidthRef = useRef(sideWidth)
  sideWidthRef.current = sideWidth

  const setSideCollapsedPersist = (collapsed: boolean) => {
    setSideCollapsed(collapsed)
    saveSideCollapsed(collapsed)
  }

  const openSide = (mode: SideMode) => {
    setSideMode(mode)
    if (sideCollapsed) setSideCollapsedPersist(false)
  }
  const { onMouseDown: onSideResizeDown } = usePanelResize({
    getWidth: () => sideWidthRef.current,
    onResize: setSideWidth,
    onCommit: (w) => {
      try {
        localStorage.setItem(SIDE_WIDTH_KEY, String(w))
      } catch {
        // ignore
      }
    },
    min: SIDE_WIDTH_MIN,
    max: SIDE_WIDTH_MAX,
    invertDelta: true
  })
  const [dismissGuide, setDismissGuide] = useState(false)
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [edgeTypes, setEdgeTypes] = useState<string[]>([])
  const [editName, setEditName] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editAliases, setEditAliases] = useState('')
  const [addEdgeToId, setAddEdgeToId] = useState('')
  const [addEdgeType, setAddEdgeType] = useState('relates_to')
  const [addEdgeQuery, setAddEdgeQuery] = useState('')
  const [addEdgeHits, setAddEdgeHits] = useState<any[]>([])
  const [selfNameReady, setSelfNameReady] = useState<boolean | null>(null)
  const [awakenProfile, setAwakenProfile] = useState<UserProfile | null>(null)
  const [awakenBusy, setAwakenBusy] = useState(false)
  const [profileForm, setProfileForm] = useState<{
    nickname: string
    birthday: string
    gender: UserGender | ''
  }>({ nickname: '', birthday: '', gender: '' })
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileErrors, setProfileErrors] = useState<{
    nickname?: boolean
    birthday?: boolean
    gender?: boolean
  }>({})
  const [sourcePreview, setSourcePreview] = useState<SourcePreview | null>(null)
  const [monthRange, setMonthRange] = useState<GraphMonthRange>(() => loadGraphMonthRange())
  const [focusDepth, setFocusDepth] = useState<GraphFocusDepth>(() => loadGraphFocusDepth())

  const inFlightDeletedNodeIdsRef = useRef(new Set<string>())
  const inFlightDeletedEdgeIdsRef = useRef(new Set<string>())
  const graphViewRef = useRef({
    nodes,
    edges,
    pendingNodes,
    pendingEdges,
    localView
  })
  graphViewRef.current = { nodes, edges, pendingNodes, pendingEdges, localView }

  const refresh = useCallback(async () => {
    const graph = await window.api.graph.getGlobalGraph({
      maxNodes: GRAPH_GLOBAL_MAX_NODES,
      monthRange: clampGraphMonthRange(monthRange)
    })
    const remapped = remapGraphViewReviewForDisplay(graph.nodes || [], graph.edges || [])
    const pending = await window.api.graph.listPending()
    const pendingView = remapGraphViewReviewForDisplay(pending.nodes || [], pending.edges || [])
    const visible = omitInFlightGraphDeletes({
      nodes: remapped.nodes,
      edges: remapped.edges,
      pendingNodes: pendingView.nodes.filter((node) => node.reviewStatus === 'pending'),
      pendingEdges: pendingView.edges.filter((edge) => edge.reviewStatus === 'pending'),
      deletedNodeIds: inFlightDeletedNodeIdsRef.current,
      deletedEdgeIds: inFlightDeletedEdgeIdsRef.current
    })
    setNodes(visible.nodes)
    setEdges(visible.edges)
    setPendingReextract(await window.api.graph.listPendingReextract())
    setPendingNodes(visible.pendingNodes)
    setPendingEdges(visible.pendingEdges)
    try {
      setEstimate(await window.api.graph.estimateExtraction())
    } catch {
      setEstimate(null)
    }
  }, [monthRange])
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  const refreshVisibleAfterReview = async () => {
    await refresh()
    if (selectedId) {
      try {
        setSelectedNode(await window.api.graph.getNode(selectedId))
      } catch {
        setSelectedNode(null)
      }
    }
    if (!pinNeighborhood || !localView) return
    if (selectedId) {
      const view = await window.api.graph.getView({
        centerNodeId: selectedId,
        depth: focusDepth === 3 ? 3 : focusDepth === 2 ? 2 : 1
      })
      setLocalView(view)
      return
    }
    const ids = (localView.nodes || []).map((n: { id?: string }) => n.id).filter(Boolean) as string[]
    const freshNodes = (
      await Promise.all(ids.map((id) => window.api.graph.getNode(id).catch(() => null)))
    ).filter((n): n is NonNullable<typeof n> => Boolean(n) && n.reviewStatus !== 'rejected')
    const edgeById = new Map<string, any>()
    for (const id of ids.slice(0, 2)) {
      const view = await window.api.graph.getView({ centerNodeId: id, depth: 1 })
      for (const edge of view.edges || []) edgeById.set(edge.id, edge)
    }
    setLocalView({
      nodes: freshNodes,
      edges: (localView.edges || [])
        .map((edge: { id: string }) => edgeById.get(edge.id) || edge)
        .filter((edge: { reviewStatus?: string }) => edge.reviewStatus !== 'rejected')
    })
  }

  const updateMonthRange = (next: GraphMonthRange | Partial<GraphMonthRange>) => {
    const merged = clampGraphMonthRange({ ...monthRange, ...next })
    saveGraphMonthRange(merged)
    setMonthRange(merged)
    setPinNeighborhood(false)
    setLocalView(null)
    setHighlightIds(new Set())
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    setSelectedId(null)
    setSelectedNode(null)
  }

  const resetMonthRange = () => {
    const next = defaultGraphMonthRange()
    setMonthRange(next)
    saveGraphMonthRange(next)
    setPinNeighborhood(false)
    setLocalView(null)
    setHighlightIds(new Set())
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    setSelectedId(null)
    setSelectedNode(null)
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

  /** 先判定唤醒状态；图谱数据由下方 refresh effect 拉取 */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const state = await loadDesktopGraphAwakenSelfName()
        if (cancelled) return
        setAwakenProfile(state.profile)
        setSelfNameReady(state.ready)
        if (!state.ready) return
        void window.api.graph.meta().then((m) => {
          if (cancelled) return
          setEdgeTypes(m.edgeTypes || [])
          if (m.edgeTypes?.[0]) setAddEdgeType(m.edgeTypes[0])
        })
      } catch (e) {
        if (cancelled) return
        setSelfNameReady(false)
        setStatus(String((e as Error)?.message || e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selfNameReady !== true) return
    void refresh().catch((e) => setStatus(String((e as Error)?.message || e)))
  }, [selfNameReady, refresh])

  useEffect(() => {
    if (!sourcePreview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSourcePreview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sourcePreview])

  useEffect(() => {
    if (!selectedNode) return
    setEditName(selectedNode.name || '')
    setEditSummary(selectedNode.summary || '')
    setEditAliases(Array.isArray(selectedNode.aliases) ? selectedNode.aliases.join(', ') : '')
    setEditNameConflict(null)
  }, [selectedNode])

  useEffect(() => {
    if (!selectedNode) {
      setEditNameConflict(null)
      return
    }
    const trimmed = editName.trim()
    if (!trimmed || trimmed === String(selectedNode.name || '').trim()) {
      setEditNameConflict(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void findGraphSameNameNode({
        name: trimmed,
        nodeType: selectedNode.nodeType,
        exceptId: selectedNode.id
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
  }, [editName, selectedNode])

  useEffect(() => {
    if (!mergeSearchOpen && !createOpen && !mergeConfirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (mergeConfirm) {
        setMergeConfirm(null)
        return
      }
      if (mergeSearchOpen) {
        setMergeSearchOpen(false)
        return
      }
      setCreateOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mergeSearchOpen, createOpen, mergeConfirm])

  const showAwakenGate = selfNameReady === false
  const awakenPending = selfNameReady === null
  const canvasNodeCount = nodes.filter((n) => n.reviewStatus !== 'rejected').length
  const showEmptyGuide =
    selfNameReady === true &&
    !dismissGuide &&
    canvasNodeCount === 0 &&
    (estimate?.entryCount ?? pendingReextract.length) > 0 &&
    isDefaultGraphMonthRange(monthRange)
  const showMonthEmpty =
    selfNameReady === true && !showEmptyGuide && canvasNodeCount === 0 && !pinNeighborhood
  const typeFilterActive = enabledNodeTypes.size !== GRAPH_FILTER_NODE_TYPES.length
  const filterActive = !hideEntry || approvedOnly || typeFilterActive
  const toggleNodeTypeFilter = (nodeType: string) => {
    setEnabledNodeTypes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeType)) next.delete(nodeType)
      else next.add(nodeType)
      return next
    })
  }

  const updateForce = (patch: Partial<GraphForceSettings>) => {
    setForceSettings((prev) => {
      const next = clampGraphForceSettings({ ...prev, ...patch })
      saveGraphForceSettings(next)
      return next
    })
  }

  const updateAppearance = (patch: Partial<GraphAppearanceSettings>) => {
    setAppearanceSettings((prev) => {
      const next = clampGraphAppearanceSettings({ ...prev, ...patch })
      saveGraphAppearanceSettings(next)
      return next
    })
  }

  const resetGraphSettings = () => {
    setForceSettings({ ...GRAPH_FORCE_DEFAULTS })
    saveGraphForceSettings({ ...GRAPH_FORCE_DEFAULTS })
    setAppearanceSettings({ ...GRAPH_APPEARANCE_DEFAULTS })
    saveGraphAppearanceSettings({ ...GRAPH_APPEARANCE_DEFAULTS })
  }

  const completeAwaken = async (fields: {
    nickname: string
    birthday: string
    gender: UserGender
  }) => {
    setAwakenBusy(true)
    try {
      await saveDesktopGraphAwakenProfile(fields)
      setSelfNameReady(true)
      setAwakenProfile((prev) => ({
        ...(prev || ({} as UserProfile)),
        nickname: fields.nickname,
        birthday: fields.birthday,
        gender: fields.gender
      }))
      setStatus('')
      void window.api.graph.meta().then((m) => {
        setEdgeTypes(m.edgeTypes || [])
        if (m.edgeTypes?.[0]) setAddEdgeType(m.edgeTypes[0])
      })
      await refresh()
    } catch (e: any) {
      setStatus(e?.message || String(e))
    } finally {
      setAwakenBusy(false)
    }
  }

  useEffect(() => {
    if (!awakenProfile) return
    const nick = awakenProfile.nickname?.trim() ?? ''
    setProfileForm({
      nickname: isDefaultGraphSelfName(nick) ? '' : nick,
      birthday: awakenProfile.birthday?.trim() || '',
      gender: (awakenProfile.gender as UserGender | undefined) || ''
    })
  }, [awakenProfile])

  const syncSelfPersonNode = async (oldName: string, newName: string) => {
    const prev = oldName.trim()
    const next = newName.trim()
    if (!prev || !next || prev === next) return false
    const hits = await window.api.graph.search({
      query: prev,
      nodeTypes: ['person'],
      limit: 20
    })
    const match = (hits || []).find((h: any) => {
      if (h.name === prev) return true
      const aliases = Array.isArray(h.aliases) ? h.aliases : []
      return aliases.includes(prev)
    })
    if (!match) return false
    const aliases = new Set<string>([
      ...(Array.isArray(match.aliases) ? match.aliases : []),
      prev
    ])
    aliases.delete(next)
    await window.api.graph.upsertNode({
      id: match.id,
      name: next,
      nodeType: 'person',
      aliases: [...aliases],
      summary: match.summary || undefined
    })
    return true
  }

  const saveProfileFromSettings = async () => {
    const nextErrors = validateGraphAwakenForm(profileForm)
    setProfileErrors({
      nickname: !!nextErrors.nickname,
      birthday: !!nextErrors.birthday,
      gender: !!nextErrors.gender
    })
    if (Object.keys(nextErrors).length > 0) return
    setProfileBusy(true)
    try {
      const oldName = awakenProfile?.nickname?.trim() || ''
      const fields = {
        nickname: profileForm.nickname.trim(),
        birthday: profileForm.birthday.trim(),
        gender: profileForm.gender as UserGender
      }
      await saveDesktopGraphAwakenProfile(fields)
      const synced = await syncSelfPersonNode(oldName, fields.nickname)
      setAwakenProfile((prev) => ({
        ...(prev || ({} as UserProfile)),
        nickname: fields.nickname,
        birthday: fields.birthday,
        gender: fields.gender
      }))
      setSelfNameReady(true)
      await refresh()
      if (selectedId) {
        const view = await window.api.graph.getView({
          centerNodeId: selectedId,
          depth: viewDepthFor(focusDepth)
        })
        setLocalView(view)
        if (selectedNode?.id === selectedId) {
          const node = await window.api.graph.getNode(selectedId)
          setSelectedNode(node)
        }
      }
      toast.showSuccess(
        synced
          ? t('graph.profile_saved_synced', '已保存，并同步更新图谱中的自称节点')
          : t('graph.profile_saved', '已保存身份资料')
      )
    } catch (e: any) {
      const message = e?.message || String(e)
      setStatus(message)
      toast.showError(message)
    } finally {
      setProfileBusy(false)
    }
  }

  const viewDepthFor = (depth: GraphFocusDepth): 1 | 2 | 3 =>
    depth === 3 ? 3 : depth === 2 ? 2 : 1

  const displayNodes = useMemo(() => {
    const filterNode = (n: any, keepPendingSelected = false) => {
      if (n.reviewStatus === 'rejected') return false
      const keepLocated = highlightedEdgeIds.size > 0 && highlightIds.has(n.id)
      if (hideEntry && n.nodeType === 'entry' && !keepLocated) return false
      if (n.nodeType !== 'entry' && !keepLocated) {
        const nt = String(n.nodeType || '')
        if (GRAPH_FILTER_NODE_TYPES.includes(nt) && !enabledNodeTypes.has(nt)) return false
      }
      if (
        approvedOnly &&
        n.reviewStatus === 'pending' &&
        !(keepPendingSelected && n.id === selectedId) &&
        !keepLocated
      ) {
        return false
      }
      return true
    }

    // Pending「查看」：整图换成无月份过滤的邻域子图。
    if (pinNeighborhood && localView?.nodes?.length) {
      return localView.nodes.filter((n) => filterNode(n, true))
    }

    const base = nodes.filter((n) => filterNode(n, true))
    if (!selectedId || base.some((n) => n.id === selectedId)) return base
    const byId = new Map(base.map((n) => [n.id as string, n]))
    const extras = [
      ...(localView?.nodes || []),
      ...(selectedNode && selectedNode.id === selectedId ? [selectedNode] : [])
    ]
    for (const n of extras) {
      if (!n?.id || byId.has(n.id)) continue
      if (!filterNode(n, true)) continue
      byId.set(n.id, n)
    }
    return [...byId.values()]
  }, [
    nodes,
    hideEntry,
    approvedOnly,
    enabledNodeTypes,
    localView,
    selectedId,
    selectedNode,
    pinNeighborhood,
    highlightIds,
    highlightedEdgeIds
  ])

  const displayEdges = useMemo(() => {
    const idSet = new Set(displayNodes.map((n) => n.id))
    const seen = new Set<string>()
    const source = pinNeighborhood
      ? localView?.edges || []
      : selectedId && !nodes.some((n) => n.id === selectedId)
        ? [...edges, ...(localView?.edges || [])]
        : edges
    return source.filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      if (e.reviewStatus === 'rejected') return false
      // 邻域定位时保留待审边，否则「查看」看不到待确认关系
      if (!pinNeighborhood && approvedOnly && e.reviewStatus === 'pending') return false
      return idSet.has(e.fromId) && idSet.has(e.toId)
    })
  }, [displayNodes, edges, approvedOnly, localView, selectedId, nodes, pinNeighborhood])

  const focusIds = useMemo(() => {
    if (!selectedId) return undefined
    // 邻域钉住时按实际子图高亮（至少覆盖当前展开等级）
    return collectGraphFocusIds(selectedId, displayEdges, focusDepth)
  }, [selectedId, displayEdges, focusDepth])

  const updateFocusDepth = (depth: GraphFocusDepth) => {
    const next = clampGraphFocusDepth(depth)
    setFocusDepth(next)
    saveGraphFocusDepth(next)
    if (pinNeighborhood && selectedId) {
      void (async () => {
        const view = await window.api.graph.getView({
          centerNodeId: selectedId,
          depth: viewDepthFor(next)
        })
        setLocalView(view)
        setLocateSeq((n) => n + 1)
      })()
    }
  }

  const detailEdges = useMemo(() => {
    if (!selectedId) return []
    const nodeById = new Map((localView?.nodes || nodes).map((n: any) => [n.id as string, n]))
    const seen = new Set<string>()
    const list: Array<{ edge: any; partnerName: string }> = []
    const edgeSource = localView?.edges?.length ? localView.edges : edges
    for (const e of edgeSource) {
      if (e.fromId !== selectedId && e.toId !== selectedId) continue
      if (seen.has(e.id)) continue
      seen.add(e.id)
      if (e.reviewStatus === 'rejected') continue
      const partnerId = e.fromId === selectedId ? e.toId : e.fromId
      const partner = nodeById.get(partnerId) || nodes.find((n: any) => n.id === partnerId)
      list.push({
        edge: e,
        partnerName: partner?.name || String(partnerId).slice(0, 8)
      })
    }
    return list
  }, [localView, selectedId, nodes, edges])

  const pendingCount = pendingNodes.length + pendingEdges.length
  const pendingItemKeys = useMemo(
    () => [
      ...pendingNodes.map((node) => graphPendingItemKey('node', node.id)),
      ...pendingEdges.map((edge) => graphPendingItemKey('edge', edge.id))
    ],
    [pendingNodes, pendingEdges]
  )
  const pendingSelectedCount = pendingItemKeys.filter((key) => pendingSelected.has(key)).length
  const allPendingSelected =
    pendingItemKeys.length > 0 && pendingSelectedCount === pendingItemKeys.length

  const onSearch = async () => {
    const q = query.trim()
    if (!q) {
      setHighlightIds(new Set())
      setHighlightedEdgeIds(new Set())
      setLocateIds(null)
      setLocalView(null)
      return
    }
    const hits = await window.api.graph.search({ query: q, limit: 20 })
    const ids = new Set((hits || []).map((h: any) => h.id as string))
    setHighlightIds(ids)
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    if (hits?.[0]) {
      setSelectedId(hits[0].id)
      const view = await window.api.graph.getView({
        centerNodeId: hits[0].id,
        depth: viewDepthFor(focusDepth)
      })
      setLocalView(view)
      setPinNeighborhood(false)
      setSelectedNode(hits[0])
      setTab('detail')
    }
  }

  const onSelectNode = async (
    id: string,
    opts?: { locate?: boolean; bypassMonth?: boolean }
  ) => {
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    // 待确认「查看」至少 2 跳；否则跟当前展开等级一致（含 3 级）
    let depthSetting = focusDepth
    if (opts?.bypassMonth && focusDepth < 2) {
      depthSetting = 2
      setFocusDepth(2)
      saveGraphFocusDepth(2)
    }
    const depth = viewDepthFor(depthSetting)
    const node = await window.api.graph.getNode(id)
    const view = await window.api.graph.getView({
      centerNodeId: id,
      depth
    })
    setSelectedId(id)
    setSelectedNode(node)
    setLocalView(view)
    if (opts?.bypassMonth) setPinNeighborhood(true)
    setSideMode('content')
    if (sideCollapsed) setSideCollapsedPersist(false)
    setTab('detail')
    if (opts?.locate || opts?.bypassMonth) setLocateSeq((n) => n + 1)
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
    const from =
      nodes.find((n) => n.id === edge.fromId) ||
      pendingNodes.find((n) => n.id === edge.fromId) ||
      (await window.api.graph.getNode(edge.fromId).catch(() => null))
    const to =
      nodes.find((n) => n.id === edge.toId) ||
      pendingNodes.find((n) => n.id === edge.toId) ||
      (await window.api.graph.getNode(edge.toId).catch(() => null))
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
    setLocateSeq((n) => n + 1)
  }

  const applyQueueSnapshot = useCallback(
    (state: GraphExtractQueueSnapshot) => {
      setExtractQueue(state)
      const running =
        state.pendingCount > 0 ||
        state.runningCount > 0 ||
        (state.aligningCount ?? 0) > 0
      setExtractRunning(running)
      if (running) {
        const done = state.completedCount
        const total = state.items.length
        const current = Math.min(
          done + state.runningCount + (state.aligningCount ?? 0),
          total
        )
        setStatus(
          t('graph.extract_queue_progress', '后台整理中 {{current}}/{{total}} · {{percent}}%（可继续添加）', {
            current,
            total,
            percent: state.overallProgress ?? graphExtractOverallProgress(state.items)
          })
        )
      } else if (state.completedCount > 0 || state.errorCount > 0) {
        setStatus(
          t('graph.extract_batch_result', '完成 {{done}}，失败 {{failed}}', {
            done: state.completedCount,
            failed: state.errorCount
          })
        )
        void refreshRef.current()
      }
    },
    [t]
  )

  const queueByPath = useMemo(() => {
    const map = new Map<string, GraphExtractQueueSnapshot['items'][number]>()
    for (const item of extractQueue?.items ?? []) {
      map.set(normalizeGraphFilePath(item.filePath), item)
    }
    return map
  }, [extractQueue])

  const queueItemCount = extractQueue?.items.length ?? 0
  const queueOverallPct =
    extractQueue?.overallProgress ??
    (queueItemCount > 0 ? graphExtractOverallProgress(extractQueue?.items ?? []) : 0)

  useEffect(() => {
    let cancelled = false
    void graphGetQueueState()
      .then((state) => {
        if (cancelled) return
        applyQueueSnapshot(state)
      })
      .catch(() => {
        // Preload/main not ready yet (e.g. mid HMR); ignore.
      })
    const unsub = graphOnQueueProgress((state) => {
      applyQueueSnapshot(state)
    })
    queueUnsubRef.current = unsub
    void graphSetExtractConcurrency(extractConcurrency).catch(() => undefined)
    return () => {
      cancelled = true
      queueUnsubRef.current?.()
      queueUnsubRef.current = null
    }
  }, [applyQueueSnapshot])

  const confirmBatchExtract = async (): Promise<boolean> => {
    const count = pendingReextract.length
    if (count <= 0) return false
    return dialog.confirm(
        t(
        'graph.confirm_batch_extract',
        '将把 {{count}} 篇待重抽日记加入整理队列。最多同时 {{concurrency}} 篇调用模型，攒满 10 篇或本批抽完后，召回相似度大于 50% 的候选并由模型判断是否合并再写入。',
        {
          count,
          concurrency: extractConcurrency
        }
      ),
      t('graph.process_pending_reextract_title', '梳理待重抽')
    )
  }

  const runExtract = async (filePaths?: string[]) => {
    const selfName = await ensureDesktopGraphSelfName()
    if (!selfName) {
      setSelfNameReady(false)
      setStatus(t('graph.self_name_required', '请先在关系图谱页完成唤醒后再抽取'))
      return
    }
    if (!filePaths?.length) {
      const ok = await confirmBatchExtract()
      if (!ok) return
    }
    setSelfNameReady(true)
    setDismissGuide(true)
    try {
      const result = await graphQueueExtract({ filePaths, concurrency: extractConcurrency })
      if (result.skippedNotEmbedded?.length) {
        toast.showInfo(
          t('graph.extract_skipped_not_embedded', '有 {{count}} 篇日记尚未嵌入，已跳过', {
            count: result.skippedNotEmbedded.length
          })
        )
      }
      if (result.queued === 0) {
        const requested = filePaths?.length
          ? filePaths
          : pendingReextract.map((item) => String(item.filePath || ''))
        const alreadyQueued = requested.some((path) => {
          const q = queueByPath.get(normalizeGraphFilePath(path))
          return isGraphExtractBusyStatus(q?.status)
        })
        if (alreadyQueued) {
          setStatus(t('graph.extract_already_queued', '已在整理队列中'))
          toast.showInfo(t('graph.extract_already_queued', '已在整理队列中'))
        } else if (result.skippedNotEmbedded?.length) {
          setStatus(
            t('graph.extract_diary_not_embedded', '这篇日记还没有向量，请先嵌入后再抽取')
          )
          toast.showInfo(
            t('graph.extract_diary_not_embedded', '这篇日记还没有向量，请先嵌入后再抽取')
          )
        } else {
          setStatus(t('graph.extract_nothing', '没有可抽取的日记'))
          toast.showInfo(t('graph.extract_nothing', '没有可抽取的日记'))
        }
        return
      }
      setExtractRunning(true)
      setStatus(
        t('graph.extract_queued', '已加入整理队列（{{count}} 篇），可继续点其他日记', {
          count: result.queued
        })
      )
      toast.showSuccess(
        t('graph.extract_queued', '已加入整理队列（{{count}} 篇），可继续点其他日记', {
          count: result.queued
        })
      )
    } catch (e: any) {
      const message = e?.message || String(e)
      const friendly =
        message === GRAPH_SELF_NAME_REQUIRED_ERROR
          ? t('graph.self_name_required', '请先设置图谱自称后再抽取')
          : message === GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR
            ? t(
                'graph.extract_embedding_required',
                '请先配置嵌入模型，并完成本篇日记的向量化后再抽取'
              )
            : message === GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR
              ? t('graph.extract_diary_not_embedded', '这篇日记还没有向量，请先嵌入后再抽取')
              : message
      setStatus(friendly)
      toast.showError(friendly)
    }
  }

  const cancelExtract = async () => {
    await graphStopExtract()
    setExtractRunning(false)
    setExtractQueue(emptyGraphExtractQueueSnapshot())
    setQueueModalOpen(false)
    setStatus(t('graph.extract_stopped', '已停止后台整理'))
    void refreshRef.current()
  }

  const cancelQueueItem = async (filePath: string) => {
    await graphCancelQueueItem(filePath)
  }

  const reviewEdge = async (
    edgeId: string,
    reviewStatus: 'approved' | 'rejected',
    endpoints?: { fromId?: string; toId?: string }
  ) => {
    await window.api.graph.setEdgeReview({ edgeId, reviewStatus })
    // Confirming a relation implies the endpoints exist — approve them together.
    if (reviewStatus === 'approved') {
      const pendingEnds = [endpoints?.fromId, endpoints?.toId].filter(Boolean) as string[]
      for (const nodeId of pendingEnds) {
        const node =
          pendingNodes.find((n) => n.id === nodeId) ||
          nodes.find((n) => n.id === nodeId && n.reviewStatus === 'pending')
        if (node) {
          await window.api.graph.setNodeReview({ nodeId, reviewStatus: 'approved' })
        }
      }
    }
    await refreshVisibleAfterReview()
  }

  const findGraphNode = (id: string) =>
    nodes.find((n) => n.id === id) || pendingNodes.find((n) => n.id === id) || null

  const openMergeConfirm = (target: GraphMergeConfirmTarget) => {
    if (target.losers.length === 0) return
    setMergeConfirm(target)
  }

  const mergeNodes = (survivorId: string, loserId: string) => {
    if (!survivorId || !loserId || survivorId === loserId) return
    const survivor = findGraphNode(survivorId)
    const loser = findGraphNode(loserId)
    openMergeConfirm({
      survivorId,
      survivorName: String(survivor?.name || survivorId),
      losers: [{ id: loserId, name: String(loser?.name || loserId) }]
    })
  }

  const runConfirmedMerge = async () => {
    if (!mergeConfirm) return
    const { survivorId, losers } = mergeConfirm
    setBusy(true)
    try {
      if (losers.length === 1) {
        await window.api.graph.mergeNodes({
          survivorId,
          loserId: losers[0]!.id,
          reason: 'explicit-merge'
        })
      } else {
        await window.api.graph.mergeNodesBatch({
          survivorId,
          loserIds: losers.map((n) => n.id),
          reason: 'explicit-merge'
        })
      }
      const loserIds = new Set(losers.map((n) => n.id))
      if (selectedId && loserIds.has(selectedId)) {
        setSelectedId(survivorId)
        setSelectedNode(null)
      }
      setMergeConfirm(null)
      setMergeSearchOpen(false)
      await refresh()
      void onSelectNode(survivorId)
      toast.showSuccess(t('graph.nodes_merged', '已合并节点'))
    } catch (e: any) {
      toast.showError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const reviewNode = async (nodeId: string, reviewStatus: 'approved' | 'rejected') => {
    await window.api.graph.setNodeReview({ nodeId, reviewStatus })
    // Approving an entity also clears its pending incident edges.
    if (reviewStatus === 'approved') {
      const incident = pendingEdges.filter((e) => e.fromId === nodeId || e.toId === nodeId)
      for (const edge of incident) {
        await window.api.graph.setEdgeReview({ edgeId: edge.id, reviewStatus: 'approved' })
      }
    }
    await refreshVisibleAfterReview()
  }

  const togglePendingItem = (key: string) => {
    setPendingSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectAllPending = () => {
    setPendingSelected(allPendingSelected ? new Set() : new Set(pendingItemKeys))
  }

  const applyPendingReviews = async (opts: {
    reviewStatus: 'approved' | 'rejected'
    allPending?: boolean
  }) => {
    const selected = opts.allPending
      ? { nodeIds: [] as string[], edgeIds: [] as string[] }
      : splitGraphReviewSelection(pendingItemKeys.filter((key) => pendingSelected.has(key)))
    if (!opts.allPending && selected.nodeIds.length === 0 && selected.edgeIds.length === 0) return
    const count = opts.allPending ? pendingCount : pendingSelectedCount
    if (count <= 0) return
    if (opts.reviewStatus === 'rejected' || opts.allPending) {
      const ok = await dialog.confirm(
        opts.allPending
          ? opts.reviewStatus === 'approved'
            ? t(
                'graph.confirm_approve_all',
                '将通过全部 {{count}} 项待确认内容。通过节点时会同时通过相连的待审关系。',
                { count }
              )
            : t(
                'graph.confirm_reject_all',
                '将拒绝全部 {{count}} 项待确认内容。拒绝节点时会同时拒绝与它相连的关系。',
                { count }
              )
          : t(
              'graph.confirm_reject_selected',
              '将拒绝已选的 {{count}} 项。拒绝节点时会同时拒绝与它相连的关系。',
              { count }
            ),
        opts.allPending
          ? opts.reviewStatus === 'approved'
            ? t('graph.approve_all', '全部通过')
            : t('graph.reject_all', '全部拒绝')
          : t('graph.reject_selected', '拒绝所选')
      )
      if (!ok) return
    }
    setBusy(true)
    try {
      await window.api.graph.setReviewsBatch({
        reviewStatus: opts.reviewStatus,
        allPending: Boolean(opts.allPending),
        nodeIds: opts.allPending ? undefined : selected.nodeIds,
        edgeIds: opts.allPending ? undefined : selected.edgeIds
      })
      setPendingSelected(new Set())
      await refreshVisibleAfterReview()
      toast.showSuccess(
        opts.reviewStatus === 'approved'
          ? t('graph.batch_approved', '已通过 {{count}} 项', { count })
          : t('graph.batch_rejected', '已拒绝 {{count}} 项', { count })
      )
    } catch (e: any) {
      toast.showError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const saveNodeEdit = async () => {
    if (!selectedNode) return
    const name = editName.trim() || selectedNode.name
    const hit =
      editNameConflict ||
      (await findGraphSameNameNode({
        name,
        nodeType: selectedNode.nodeType,
        exceptId: selectedNode.id
      }))
    if (hit) {
      setEditNameConflict(hit)
      toast.showError(
        t('graph.same_name_save_blocked', '已有同名节点「{{name}}」。请先换名，或把它合并过去。', {
          name: hit.name
        })
      )
      return
    }
    setBusy(true)
    try {
      const aliases = editAliases
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean)
      const result = await window.api.graph.upsertNode({
        id: selectedNode.id,
        name,
        nodeType: selectedNode.nodeType,
        aliases,
        summary: editSummary
      })
      if (isGraphNodeSameNameConflict(result)) {
        setEditNameConflict(result.existing)
        toast.showError(
          t('graph.same_name_save_blocked', '已有同名节点「{{name}}」。请先换名，或把它合并过去。', {
            name: result.existing.name
          })
        )
        return
      }
      toast.showSuccess(t('graph.edit_saved', '已保存（手工修正，重抽不会覆盖）'))
      await refresh()
      const node = await window.api.graph.getNode(selectedNode.id)
      setSelectedNode(node)
    } catch (e: any) {
      const message = e?.message || String(e)
      toast.showError(message)
    } finally {
      setBusy(false)
    }
  }

  const deleteSelectedNode = async () => {
    if (!selectedNode) return
    const ok = await dialog.confirm(
      t('graph.confirm_delete_node', '确定删除该节点？相关边也会一并删除。'),
      t('graph.delete_node', '删除节点')
    )
    if (!ok) return
    const nodeId = selectedNode.id
    const snapshot = {
      nodes,
      edges,
      pendingNodes,
      pendingEdges,
      pendingSelected,
      highlightIds,
      highlightedEdgeIds,
      locateIds,
      localView,
      selectedId,
      selectedNode,
      pinNeighborhood
    }
    const next = applyGraphLocalNodeDelete({
      nodeId,
      nodes,
      edges,
      pendingNodes,
      pendingEdges,
      pendingSelected,
      highlightIds,
      highlightedEdgeIds,
      locateIds,
      localView
    })
    setNodes(next.nodes)
    setEdges(next.edges)
    setPendingNodes(next.pendingNodes)
    setPendingEdges(next.pendingEdges)
    setPendingSelected(next.pendingSelected)
    setHighlightIds(next.highlightIds)
    setHighlightedEdgeIds(next.highlightedEdgeIds)
    setLocateIds(next.locateIds && next.locateIds.length > 0 ? next.locateIds : null)
    setLocalView(next.localView)
    setSelectedNode(null)
    setSelectedId(null)
    setPinNeighborhood(false)
    inFlightDeletedNodeIdsRef.current.add(nodeId)
    for (const edge of snapshot.edges) {
      if (edge.fromId === nodeId || edge.toId === nodeId) {
        inFlightDeletedEdgeIdsRef.current.add(edge.id)
      }
    }
    toast.showSuccess(t('graph.node_deleted', '已删除节点'))
    void window.api.graph.softDelete({ kind: 'node', id: nodeId }).then(
      () => {
        inFlightDeletedNodeIdsRef.current.delete(nodeId)
        for (const edge of snapshot.edges) {
          if (edge.fromId === nodeId || edge.toId === nodeId) {
            inFlightDeletedEdgeIdsRef.current.delete(edge.id)
          }
        }
      },
      (e: unknown) => {
        inFlightDeletedNodeIdsRef.current.delete(nodeId)
        for (const edge of snapshot.edges) {
          if (edge.fromId === nodeId || edge.toId === nodeId) {
            inFlightDeletedEdgeIdsRef.current.delete(edge.id)
          }
        }
        const restored = restoreGraphLocalNodeDelete({
          nodeId,
          current: graphViewRef.current,
          before: snapshot
        })
        setNodes(restored.nodes)
        setEdges(restored.edges)
        setPendingNodes(restored.pendingNodes)
        setPendingEdges(restored.pendingEdges)
        setLocalView(restored.localView)
        const message = e instanceof Error ? e.message : String(e)
        setStatus(message)
        toast.showError(message)
      }
    )
  }

  const deleteEdge = async (edgeId: string) => {
    const ok = await dialog.confirm(
      t('graph.confirm_delete_edge', '确定删除这条关系？'),
      t('graph.delete_edge', '删除')
    )
    if (!ok) return
    const snapshot = {
      edges,
      pendingEdges,
      pendingSelected,
      highlightedEdgeIds,
      localView
    }
    const next = applyGraphLocalEdgeDelete({
      edgeId,
      edges,
      pendingEdges,
      pendingSelected,
      highlightedEdgeIds,
      localView
    })
    setEdges(next.edges)
    setPendingEdges(next.pendingEdges)
    setPendingSelected(next.pendingSelected)
    setHighlightedEdgeIds(next.highlightedEdgeIds)
    setLocalView(next.localView)
    inFlightDeletedEdgeIdsRef.current.add(edgeId)
    toast.showSuccess(t('graph.edge_deleted', '已删除关系'))
    void window.api.graph.softDelete({ kind: 'edge', id: edgeId }).then(
      () => {
        inFlightDeletedEdgeIdsRef.current.delete(edgeId)
      },
      (e: unknown) => {
        inFlightDeletedEdgeIdsRef.current.delete(edgeId)
        const restored = restoreGraphLocalEdgeDelete({
          edgeId,
          current: graphViewRef.current,
          before: snapshot
        })
        setEdges(restored.edges)
        setPendingEdges(restored.pendingEdges)
        setLocalView(restored.localView)
        const message = e instanceof Error ? e.message : String(e)
        setStatus(message)
        toast.showError(message)
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
    setAddEdgeHits((hits || []).filter((h: any) => h.id !== selectedId))
  }

  const addEdge = async () => {
    if (!selectedId || !addEdgeToId) return
    setBusy(true)
    try {
      await window.api.graph.upsertEdge({
        fromId: selectedId,
        toId: addEdgeToId,
        edgeType: addEdgeType
      })
      setAddEdgeToId('')
      setAddEdgeQuery('')
      setAddEdgeHits([])
      setStatus(t('graph.edge_added', '已添加关系'))
      await refresh()
      const view = await window.api.graph.getView({
        centerNodeId: selectedId,
        depth: viewDepthFor(focusDepth)
      })
      setLocalView(view)
    } catch (e: any) {
      setStatus(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const openSource = async (
    dateOrRef: string | null | undefined,
    fallbackExcerpt?: string | null
  ) => {
    const raw = String(dateOrRef || '').trim()
    const dateMatch = raw.match(/(\d{4}-\d{2}-\d{2})/)
    const date = dateMatch?.[1] ?? (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null)
    const excerpt = String(fallbackExcerpt || '').trim()

    if (!date && !excerpt && !raw) {
      toast.showInfo(t('graph.source_unavailable', '没有可预览的原文'))
      return
    }

    // Open immediately so the click always has visible feedback.
    setSourcePreview({
      date,
      content: excerpt || '',
      excerpt: excerpt || null,
      loading: Boolean(date)
    })

    if (!date) {
      setSourcePreview({
        date: null,
        content: excerpt || raw,
        excerpt: excerpt || null,
        loading: false
      })
      return
    }

    try {
      const [entry, attachmentDir] = await Promise.all([
        window.api.diary.findByDate(date),
        window.api.diary.getAttachmentDir?.(date).catch(() => '') ?? Promise.resolve('')
      ])
      const content = String((entry as { content?: string } | null)?.content || '').trim() || excerpt
      setSourcePreview({
        date,
        content: content || t('graph.source_not_found', '未找到该日日记原文'),
        excerpt: excerpt || null,
        basePath: attachmentDir || undefined,
        loading: false
      })
    } catch (e: any) {
      setSourcePreview({
        date,
        content: excerpt || e?.message || t('graph.source_load_failed', '加载原文失败'),
        excerpt: excerpt || null,
        loading: false
      })
      if (!excerpt) toast.showError(e?.message || t('graph.source_load_failed', '加载原文失败'))
    }
  }

  const formatTokens = (n: number) => {
    if (n >= 10000) return t('graph.tokens_wan', '约 {{n}} 万', { n: (n / 10000).toFixed(1) })
    return t('graph.tokens_count', '约 {{n}}', { n })
  }

  const phaseKey = awakenPending ? 'boot' : showAwakenGate ? 'awaken' : 'main'
  const phaseTransition = { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <div className={styles.root}>
      <AnimatePresence initial={false}>
        {phaseKey === 'boot' ? (
          <motion.div
            key="boot"
            className={`${styles.phase} ${styles.bootShell}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            aria-busy="true"
          >
            <div className={styles.bootAtmosphere} />
          </motion.div>
        ) : null}
        {phaseKey === 'awaken' ? (
          <motion.div
            key="awaken"
            className={styles.phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={phaseTransition}
          >
            <GraphAwakenWelcome
              initialProfile={awakenProfile}
              busy={awakenBusy}
              onSubmit={completeAwaken}
            />
          </motion.div>
        ) : null}
        {phaseKey === 'main' ? (
          <motion.div
            key="main"
            className={`${styles.mainPhase} ${showEmptyGuide ? styles.mainPhaseEmpty : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={phaseTransition}
          >
      <div className={styles.chrome}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.titleRow}>
            <div className={styles.title}>{t('graph.title', '人生关系图')}</div>
            <HelpTooltip
              size={15}
              content={t(
                'graph.title_help',
                '这是从日记里整理出的人物、地点和事件关系。笔记本里的关系图是另一套库，不会混在这里。'
              )}
            />
          </div>
          {!showEmptyGuide ? (
            <div className={styles.searchGroup}>
              <div className={styles.searchField}>
                <Input
                  fieldSize="small"
                  placeholder={t('graph.search_placeholder', '搜索实体 / 别名')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void onSearch()
                  }}
                  trailing={
                    <button
                      type="button"
                      className={styles.searchBtn}
                      aria-label={t('graph.search', '搜索')}
                      title={t('graph.search', '搜索')}
                      onClick={() => void onSearch()}
                    >
                      <Search size={15} strokeWidth={2.25} />
                    </button>
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
        {!showEmptyGuide || extractRunning ? (
          <div className={styles.toolbarRight}>
            {!showEmptyGuide ? (
              <>
                <GraphMonthRangePicker
                  value={monthRange}
                  onChange={(next) => updateMonthRange(next)}
                />
                <button
                  type="button"
                  className={styles.btn}
                  title={t(
                    'graph.global_view_hint',
                    '退出当前查看的局部关系，显示这个月份范围内的全部节点。不会改月份范围。'
                  )}
                  aria-label={t(
                    'graph.global_view_hint',
                    '退出当前查看的局部关系，显示这个月份范围内的全部节点。不会改月份范围。'
                  )}
                  onClick={clearToGlobal}
                >
                  {t('graph.global_view', '全局')}
                </button>
              </>
            ) : null}
            {sideCollapsed && !showEmptyGuide ? (
              <button
                type="button"
                className={`${styles.btnPrimary} ${styles.btnBatchExtract} ${
                  highlightStartOrganize ? styles.highlightStartOrganize : ''
                }`}
                disabled={pendingReextract.length === 0}
                title={t('graph.process_pending_reextract_hint', '把当前待重抽日记加入整理队列')}
                onClick={() => void runExtract()}
              >
                {t('graph.process_pending_reextract', '梳理待重抽 ({{count}})', {
                  count: pendingReextract.length
                })}
              </button>
            ) : null}
            {extractRunning ? (
              <button type="button" className={styles.btn} onClick={() => setQueueModalOpen(true)}>
                {t('graph.queue_view_progress', '查看进度')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {status ? (
        <button
          type="button"
          className={`${styles.statusBar} ${extractRunning || busy ? styles.statusBarBusy : ''} ${
            extractRunning || queueItemCount > 0 ? styles.statusBarAction : ''
          }`}
          onClick={() => {
            if (extractRunning || queueItemCount > 0) setQueueModalOpen(true)
          }}
        >
          {status}
        </button>
      ) : null}
      {!embedded ? (
        <MemoryReadinessBar
          rows={readiness.rows}
          onConfigureEmbedding={() => navigate(`${SETTINGS_HUB_PREFIX}/ai-models`)}
          onStartIndex={() => navigate('/memory/vectors')}
          onStartOrganize={() => void runExtract()}
        />
      ) : null}
      </div>

      <div className={styles.canvasWrap}>
        {showEmptyGuide ? (
          <div className={styles.emptyGuide}>
            <div className={styles.emptyGuideTitle}>
              {t('graph.empty_guide_title', '还没有开始整理你的人生关系图')}
            </div>
            <div className={styles.emptyGuideBody}>
              {t(
                'graph.empty_guide_body',
                '发现 {{count}} 篇日记可以分析，预计消耗 {{tokens}} tokens，用时约 {{minLow}}–{{minHigh}} 分钟。',
                {
                  count: estimate?.entryCount ?? pendingReextract.length,
                  tokens: formatTokens(estimate?.estimatedTokens ?? 0),
                  minLow: estimate?.estimatedMinutesLow ?? 1,
                  minHigh: estimate?.estimatedMinutesHigh ?? 1
                }
              )}
            </div>
            <div className={styles.emptyGuideHint}>
              {t('graph.legend_pending', '虚线的关系伙伴还看不到，需要你确认。')}
            </div>
            <div className={styles.rowActions}>
              <button
                type="button"
                className={`${styles.btnPrimary} ${
                  highlightStartOrganize ? styles.highlightStartOrganize : ''
                }`}
                onClick={() => void runExtract()}
              >
                {t('graph.start_organize', '开始整理')}
              </button>
              <button type="button" className={styles.btn} onClick={() => setDismissGuide(true)}>
                {t('graph.later', '以后再说')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <GraphForceCanvas
              nodes={displayNodes}
              edges={displayEdges}
              highlightIds={highlightIds}
              highlightEdgeIds={highlightedEdgeIds}
              locateIds={locateIds ?? undefined}
              focusIds={focusIds}
              selectedId={selectedId}
              locateSeq={locateSeq}
              forceSettings={forceSettings}
              appearanceSettings={appearanceSettings}
              animationTick={animationTick}
              onSelectNode={(id) => {
                void onSelectNode(id)
              }}
              onClearSelection={() => {
                // 邻域「查看」模式下：空白单击仅取消选中，不退回月份主图
                setHighlightIds(new Set())
                setHighlightedEdgeIds(new Set())
                setLocateIds(null)
                setSelectedId(null)
                setSelectedNode(null)
              }}
            />
            {showMonthEmpty ? (
              <div className={styles.monthEmpty}>
                <div className={styles.monthEmptyTitle}>
                  {t('graph.month_empty_title', '这个月份范围内还没有关系')}
                </div>
                <div className={styles.monthEmptyBody}>
                  {t(
                    'graph.month_empty_body',
                    '当前显示 {{start}} — {{end}}。可扩大月份范围，或先梳理日记。',
                    {
                      start: monthRange.startMonth,
                      end: monthRange.endMonth
                    }
                  )}
                </div>
                <div className={styles.rowActions}>
                  <button type="button" className={styles.btn} onClick={resetMonthRange}>
                    {t('graph.month_range_recent3', '近3月')}
                  </button>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => {
                      const start = parseGraphMonthToDate(monthRange.startMonth)
                      start.setMonth(start.getMonth() - 12)
                      updateMonthRange({ startMonth: formatGraphMonth(start) })
                    }}
                  >
                    {t('graph.month_range_earlier', '再往前一年')}
                  </button>
                </div>
              </div>
            ) : null}
            <div className={styles.legend}>
              {highlightedEdgeIds.size > 0
                ? t(
                    'graph.legend_pending_edge',
                    '已定位这条关系：两端节点和中间连线已高亮；单击空白取消。'
                  )
                : selectedId
                ? t(
                    'graph.legend_focus_depth',
                    '已选中：高亮 {{depth}} 级关系（共 {{count}} 个节点）；单击空白取消。',
                    {
                      depth: focusDepth,
                      count: focusIds?.size ?? 1
                    }
                  )
                : t(
                    'graph.legend_month',
                    '默认显示近 3 个月的关系；可在顶部栏调整月份范围。'
                  )}
            </div>
          </>
        )}
      </div>

      {!showEmptyGuide ? (
      <div
        className={`${styles.sideColumn}${sideCollapsed ? ` ${styles.sideColumnCollapsed}` : ''}`}
        style={
          sideCollapsed
            ? undefined
            : { ['--graph-side-width' as string]: `${sideWidth}px` }
        }
      >
        {!sideCollapsed ? (
          <div
            className={styles.sideResizeSash}
            role="separator"
            aria-orientation="vertical"
            aria-label={t('graph.resize_sidebar', '调整侧栏宽度')}
            onMouseDown={onSideResizeDown}
          />
        ) : null}
        <div className={styles.sideRail} role="tablist" aria-label={t('graph.side_rail', '侧栏')}>
          <button
            type="button"
            role="tab"
            aria-selected={!sideCollapsed && sideMode === 'ops'}
            className={`${styles.railBtn} ${
              !sideCollapsed && sideMode === 'ops' ? styles.railBtnActive : ''
            }`}
            title={t('graph.side_ops', '操作')}
            onClick={() => openSide('ops')}
          >
            <MdTune size={18} />
            {filterActive || pendingReextract.length > 0 || extractRunning ? (
              <span className={styles.railDot} aria-hidden />
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!sideCollapsed && sideMode === 'settings'}
            className={`${styles.railBtn} ${
              !sideCollapsed && sideMode === 'settings' ? styles.railBtnActive : ''
            }`}
            title={t('graph.side_settings', '设置')}
            onClick={() => openSide('settings')}
          >
            <MdSettings size={18} />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!sideCollapsed && sideMode === 'content'}
            className={`${styles.railBtn} ${
              !sideCollapsed && sideMode === 'content' ? styles.railBtnActive : ''
            }`}
            title={t('graph.side_content', '内容')}
            onClick={() => openSide('content')}
          >
            <MdArticle size={18} />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${styles.railCollapseBtn}`}
            title={
              sideCollapsed
                ? t('graph.expand_sidebar', '展开侧栏')
                : t('graph.collapse_sidebar', '收起侧栏')
            }
            aria-expanded={!sideCollapsed}
            onClick={() => setSideCollapsedPersist(!sideCollapsed)}
          >
            {sideCollapsed ? <MdChevronLeft size={18} /> : <MdChevronRight size={18} />}
          </button>
        </div>
        {!sideCollapsed ? (
      <aside className={styles.side}>
        {sideMode === 'ops' ? (
          <>
            <div className={styles.settingsHeader}>
              <div className={styles.settingsTitle}>{t('graph.side_ops', '操作')}</div>
            </div>
            <div className={styles.panel}>
              <div className={styles.opsBlock}>
                <button
                  type="button"
                  className={`${styles.btnPrimary} ${styles.opsFullBtn}`}
                  disabled={pendingReextract.length === 0}
                  title={t('graph.process_pending_reextract_hint', '把当前待重抽日记加入整理队列')}
                  onClick={() => void runExtract()}
                >
                  {t('graph.process_pending_reextract', '梳理待重抽 ({{count}})', {
                    count: pendingReextract.length
                  })}
                </button>
                {extractRunning ? (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.opsFullBtn}`}
                    onClick={() => setQueueModalOpen(true)}
                  >
                    {t('graph.queue_view_progress', '查看进度')}
                  </button>
                ) : null}
                <div className={styles.opsConcurrency}>
                  <div className={styles.opsLabelRow}>
                    <span className={styles.viewFieldLabel}>
                      {t('graph.extract_concurrency', '同时抽取')}
                    </span>
                    <GraphExtractHelpButton size={14} />
                  </div>
                  <Select
                    size="small"
                    value={String(extractConcurrency)}
                    onChange={(e) => {
                      const n = saveGraphExtractConcurrency(e.target.value)
                      setExtractConcurrency(n)
                      void graphSetExtractConcurrency(n)
                    }}
                    options={Array.from(
                      { length: GRAPH_EXTRACT_CONCURRENCY_MAX - GRAPH_EXTRACT_CONCURRENCY_MIN + 1 },
                      (_, i) => {
                        const n = GRAPH_EXTRACT_CONCURRENCY_MIN + i
                        return { value: String(n), label: String(n) }
                      }
                    )}
                  />
                </div>
              </div>

              <div className={styles.opsBlock}>
                <div className={styles.viewFieldLabel}>{t('graph.ops_nodes', '节点')}</div>
                <div className={styles.opsBtnRow}>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={busy}
                    onClick={() => {
                      setMergeSearchOpen(false)
                      setCreateOpen(true)
                    }}
                  >
                    {t('graph.create_node', '新建节点')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${mergeSearchOpen ? styles.btnActive : ''}`}
                    disabled={busy}
                    onClick={() => {
                      setCreateOpen(false)
                      setMergeSearchOpen((open) => !open)
                    }}
                  >
                    {t('graph.merge_nodes', '合并节点')}
                  </button>
                </div>
              </div>

              <div className={styles.opsBlock}>
                <div className={styles.filterSectionHead}>
                  <span className={styles.viewFieldLabel}>{t('graph.filter', '筛选')}</span>
                  {filterActive ? (
                    <button
                      type="button"
                      className={styles.filterSectionAction}
                      onClick={() => {
                        setHideEntry(true)
                        setApprovedOnly(false)
                        setEnabledNodeTypes(new Set(GRAPH_FILTER_NODE_TYPES))
                      }}
                    >
                      {t('graph.filter_reset', '恢复默认')}
                    </button>
                  ) : null}
                </div>
                <label className={styles.checkLabel}>
                  <Checkbox
                    checked={hideEntry}
                    onChange={(e) => setHideEntry(e.target.checked)}
                  />
                  {t('graph.hide_entry_anchors', '隐藏日记锚点')}
                </label>
                <label className={styles.checkLabel}>
                  <Checkbox
                    checked={approvedOnly}
                    onChange={(e) => setApprovedOnly(e.target.checked)}
                  />
                  {t('graph.approved_only', '只看已确认')}
                </label>
                <div className={styles.filterSection}>
                  <div className={styles.filterSectionHead}>
                    <span className={styles.filterSectionTitle}>
                      {t('graph.filter_by_type', '按分类')}
                    </span>
                    <button
                      type="button"
                      className={styles.filterSectionAction}
                      onClick={() =>
                        setEnabledNodeTypes(
                          typeFilterActive
                            ? new Set(GRAPH_FILTER_NODE_TYPES)
                            : new Set()
                        )
                      }
                    >
                      {typeFilterActive
                        ? t('graph.filter_select_all_types', '全选')
                        : t('graph.filter_clear_types', '清空')}
                    </button>
                  </div>
                  <div className={styles.typeChipRow}>
                    {GRAPH_FILTER_NODE_TYPES.map((nodeType) => {
                      const active = enabledNodeTypes.has(nodeType)
                      const typeColor = graphNodeTypeColor(nodeType)
                      return (
                        <button
                          key={nodeType}
                          type="button"
                          className={active ? styles.typeChipActive : styles.typeChip}
                          style={
                            active
                              ? ({ '--type-chip-color': typeColor } as React.CSSProperties)
                              : undefined
                          }
                          onClick={() => toggleNodeTypeFilter(nodeType)}
                        >
                          {t(
                            `graph.node_type.${nodeType}`,
                            GRAPH_NODE_TYPE_LABEL_FALLBACKS[nodeType] ?? nodeType
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : sideMode === 'settings' ? (
          <>
            <div className={styles.settingsHeader}>
              <div className={styles.settingsTitle}>{t('graph.side_settings', '设置')}</div>
              <button
                type="button"
                className={styles.settingsReset}
                title={t('graph.force_reset', '恢复默认')}
                onClick={resetGraphSettings}
              >
                {t('graph.force_reset', '恢复默认')}
              </button>
            </div>
            <div className={styles.panel}>
              <div className={styles.settingsSection}>
                <button
                  type="button"
                  className={styles.settingsSectionHead}
                  onClick={() => setProfileSectionOpen((open) => !open)}
                >
                  <span className={styles.settingsChevron}>
                    {profileSectionOpen ? '▾' : '▸'}
                  </span>
                  {t('graph.profile_section', '身份资料')}
                </button>
                {profileSectionOpen ? (
                  <div className={styles.settingsSectionBody}>
                    <p className={styles.profileHint}>
                      {t(
                        'graph.profile_hint',
                        '用于识别日记中的「我」。修改昵称会同步更新图谱中的自称节点，旧昵称保留为别名，无需重建整图。'
                      )}
                    </p>
                    <div className={styles.profileFields}>
                      <label className={styles.profileField}>
                        <span>{t('graph.awaken_nickname_label', '昵称')}</span>
                        <Input
                          fieldSize="small"
                          value={profileForm.nickname}
                          onChange={(e) =>
                            setProfileForm((p) => ({ ...p, nickname: e.target.value }))
                          }
                          placeholder={t('graph.awaken_nickname_placeholder', '怎么称呼你？')}
                          disabled={profileBusy}
                        />
                        {profileErrors.nickname ? (
                          <span className={styles.profileError}>
                            {t('graph.awaken_nickname_required', '请填写昵称')}
                          </span>
                        ) : null}
                      </label>
                      <div className={styles.profileField}>
                        <span>{t('graph.awaken_birthday_label', '生日')}</span>
                        <GraphAwakenBirthdayField
                          value={profileForm.birthday}
                          onChange={(birthday) =>
                            setProfileForm((p) => ({ ...p, birthday }))
                          }
                          disabled={profileBusy}
                          hasError={!!profileErrors.birthday}
                        />
                        {profileErrors.birthday ? (
                          <span className={styles.profileError}>
                            {t('graph.awaken_birthday_required', '请选择生日')}
                          </span>
                        ) : null}
                      </div>
                      <div className={styles.profileField}>
                        <span>{t('graph.awaken_gender_label', '性别')}</span>
                        <div className={styles.genderRow} role="radiogroup">
                          {USER_GENDER_OPTIONS.map((g) => {
                            const label =
                              g === 'male'
                                ? t('graph.awaken_gender_male', '男')
                                : g === 'female'
                                  ? t('graph.awaken_gender_female', '女')
                                  : g === 'other'
                                    ? t('graph.awaken_gender_other', '其他')
                                    : t('graph.awaken_gender_unspecified', '不愿透露')
                            return (
                              <button
                                key={g}
                                type="button"
                                role="radio"
                                aria-checked={profileForm.gender === g}
                                className={
                                  profileForm.gender === g
                                    ? styles.genderChipActive
                                    : styles.genderChip
                                }
                                disabled={profileBusy}
                                onClick={() => setProfileForm((p) => ({ ...p, gender: g }))}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                        {profileErrors.gender ? (
                          <span className={styles.profileError}>
                            {t('graph.awaken_gender_required', '请选择性别')}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        disabled={profileBusy}
                        onClick={() => void saveProfileFromSettings()}
                      >
                        {t('graph.profile_save', '保存身份资料')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <GraphCanvasSettingsPanel
                focusDepth={focusDepth}
                appearanceSettings={appearanceSettings}
                forceSettings={forceSettings}
                onFocusDepthChange={updateFocusDepth}
                onAppearanceChange={updateAppearance}
                onForceChange={updateForce}
                onReplayLayout={() => setAnimationTick((n) => n + 1)}
              />
            </div>
          </>
        ) : (
          <>
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${tab === 'reextract' ? styles.tabActive : ''}`}
                onClick={() => setTab('reextract')}
              >
                {t('graph.tab_reextract', '待重抽')}
              </button>
              <button
                type="button"
                className={`${styles.tab} ${tab === 'pending' ? styles.tabActive : ''}`}
                onClick={() => setTab('pending')}
              >
                {t('graph.tab_pending_count', '待确认 ({{count}})', { count: pendingCount })}
              </button>
              <button
                type="button"
                className={`${styles.tab} ${tab === 'detail' ? styles.tabActive : ''}`}
                onClick={() => setTab('detail')}
              >
                {t('graph.tab_detail', '详情')}
              </button>
            </div>
            <div className={styles.panel}>
          {tab === 'reextract' && (
            <>
              {pendingReextract.length === 0 ? (
                <div className={styles.empty}>
                  {t('graph.no_pending_reextract', '暂无待重抽日记')}
                </div>
              ) : (
                pendingReextract.map((item) => (
                  <div
                    key={item.filePath}
                    className={styles.itemCompact}
                    title={item.filePath}
                  >
                    <div className={styles.itemRow}>
                      <div className={styles.itemTitle}>{item.date || item.filePath}</div>
                      <div className={styles.rowActionsInline}>
                        {(() => {
                          const q = queueByPath.get(normalizeGraphFilePath(item.filePath))
                          if (q?.status === 'running') {
                            return (
                              <span className={styles.queueBadge}>
                                {t('graph.queue_running', '抽取中')}
                              </span>
                            )
                          }
                          if (q?.status === 'aligning') {
                            return (
                              <span className={styles.queueBadge}>
                                {t('graph.extract_aligning', '对齐中')}
                              </span>
                            )
                          }
                          if (q?.status === 'pending') {
                            return (
                              <>
                                <span className={styles.queueBadge}>
                                  {t('graph.queue_pending', '排队中')}
                                </span>
                                <button
                                  type="button"
                                  className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                                  onClick={() => void cancelQueueItem(item.filePath)}
                                >
                                  {t('graph.queue_remove', '取消')}
                                </button>
                              </>
                            )
                          }
                          if (q?.status === 'completed') {
                            return (
                              <span className={styles.queueBadgeDone}>
                                {t('graph.queue_done', '已完成')}
                              </span>
                            )
                          }
                          return (
                            <button
                              type="button"
                              className={styles.linkBtn}
                              onClick={() => void runExtract([item.filePath])}
                            >
                              {t('graph.extract_short', '抽取')}
                            </button>
                          )
                        })()}
                        {item.date ? (
                          <button
                            type="button"
                            className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                            onClick={() => void openSource(item.date)}
                          >
                            {t('graph.open_source_short', '原文')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === 'pending' && (
            <>
              {pendingCount === 0 ? (
                <div className={styles.empty}>{t('graph.no_pending', '没有待确认的节点或边')}</div>
              ) : (
                <>
                  <div className={styles.pendingSticky}>
                    <p className={styles.pendingHint}>
                      {t(
                        'graph.pending_hint',
                        '确认关系会同时通过两端节点；确认节点也会通过与它相连的待审关系。可勾选后批量处理。'
                      )}
                    </p>
                    <div className={styles.pendingToolbar}>
                      <label className={styles.pendingSelectAll}>
                        <Checkbox
                          checked={allPendingSelected}
                          indeterminate={pendingSelectedCount > 0 && !allPendingSelected}
                          onChange={toggleSelectAllPending}
                        />
                        {allPendingSelected
                          ? t('graph.pending_deselect_all', '取消全选')
                          : t('graph.pending_select_all', '全选')}
                      </label>
                      <span className={styles.pendingSelectedCount}>
                        {t('graph.pending_selected_count', '已选 {{count}} 项', {
                          count: pendingSelectedCount
                        })}
                      </span>
                      <div className={styles.pendingToolbarBtns}>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          disabled={busy || pendingSelectedCount === 0}
                          onClick={() => void applyPendingReviews({ reviewStatus: 'approved' })}
                        >
                          {t('graph.approve_selected', '通过所选')}
                        </button>
                        <button
                          type="button"
                          className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                          disabled={busy || pendingSelectedCount === 0}
                          onClick={() => void applyPendingReviews({ reviewStatus: 'rejected' })}
                        >
                          {t('graph.reject_selected', '拒绝所选')}
                        </button>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          disabled={busy}
                          onClick={() =>
                            void applyPendingReviews({ reviewStatus: 'approved', allPending: true })
                          }
                        >
                          {t('graph.approve_all', '全部通过')}
                        </button>
                        <button
                          type="button"
                          className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                          disabled={busy}
                          onClick={() =>
                            void applyPendingReviews({ reviewStatus: 'rejected', allPending: true })
                          }
                        >
                          {t('graph.reject_all', '全部拒绝')}
                        </button>
                      </div>
                    </div>
                  </div>
                  {pendingNodes.map((node) => {
                    const key = graphPendingItemKey('node', node.id)
                    return (
                      <div key={`n-${node.id}`} className={styles.itemCompact}>
                        <div className={styles.itemRow}>
                          <label className={styles.pendingCheckLabel}>
                            <Checkbox
                              checked={pendingSelected.has(key)}
                              onChange={() => togglePendingItem(key)}
                            />
                            <span className={styles.itemTitle}>
                              {t('graph.pending_node', '节点')} · {node.name}
                            </span>
                          </label>
                          <div className={styles.rowActionsInline}>
                            <button
                              type="button"
                              className={styles.linkBtn}
                              onClick={() => void reviewNode(node.id, 'approved')}
                            >
                              {t('graph.approve', '通过')}
                            </button>
                            <button
                              type="button"
                              className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                              onClick={() => void reviewNode(node.id, 'rejected')}
                            >
                              {t('graph.reject', '拒绝')}
                            </button>
                            <button
                              type="button"
                              className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                              onClick={() => locatePendingNode(node.id)}
                            >
                              {t('graph.view', '查看')}
                            </button>
                          </div>
                        </div>
                        {node.nodeType || node.summary ? (
                          <div className={styles.itemMetaCompact}>
                            {translateGraphNodeType(tr, node.nodeType)}
                            {node.summary ? ` · ${node.summary}` : ''}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                  {pendingEdges.map((edge) => {
                    const key = graphPendingItemKey('edge', edge.id)
                    const fromName =
                      nodes.find((n) => n.id === edge.fromId)?.name ||
                      pendingNodes.find((n) => n.id === edge.fromId)?.name ||
                      edge.fromId.slice(0, 8)
                    const toName =
                      nodes.find((n) => n.id === edge.toId)?.name ||
                      pendingNodes.find((n) => n.id === edge.toId)?.name ||
                      edge.toId.slice(0, 8)
                    return (
                      <div key={`e-${edge.id}`} className={styles.itemCompact}>
                        <div className={styles.itemRow}>
                          <label className={styles.pendingCheckLabel}>
                            <Checkbox
                              checked={pendingSelected.has(key)}
                              onChange={() => togglePendingItem(key)}
                            />
                            <span className={styles.itemTitle}>
                              {t('graph.pending_edge', '关系')} ·{' '}
                              {translateGraphEdgeType(tr, edge.edgeType)}
                            </span>
                          </label>
                          <div className={styles.rowActionsInline}>
                            <button
                              type="button"
                              className={styles.linkBtn}
                              onClick={() =>
                                void reviewEdge(edge.id, 'approved', {
                                  fromId: edge.fromId,
                                  toId: edge.toId
                                })
                              }
                            >
                              {t('graph.approve', '通过')}
                            </button>
                            <button
                              type="button"
                              className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                              onClick={() => void reviewEdge(edge.id, 'rejected')}
                            >
                              {t('graph.reject', '拒绝')}
                            </button>
                            <button
                              type="button"
                              className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                              onClick={() => void locatePendingEdge(edge)}
                            >
                              {t('graph.view', '查看')}
                            </button>
                            <button
                              type="button"
                              className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                              onClick={() => void openSource(edge.sourceRef, edge.sourceExcerpt)}
                            >
                              {t('graph.source', '原文')}
                            </button>
                          </div>
                        </div>
                        <div className={styles.itemMetaCompact}>
                          {fromName} → {toName}
                          {typeof edge.confidence === 'number' ? ` · ${edge.confidence}` : ''}
                          {edge.sourceExcerpt ? ` · ${edge.sourceExcerpt}` : ''}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </>
          )}

          {tab === 'detail' && (
            <>
              {!selectedNode ? (
                <div className={styles.empty}>
                  {t('graph.click_node_for_detail', '点击画布节点查看详情')}
                </div>
              ) : (
                <>
                  <div className={styles.detailDepthRow}>
                    <div className={styles.detailDepthMeta}>
                      <span className={styles.detailLabel}>{t('graph.focus_depth', '展开等级')}</span>
                      <span className={styles.detailDepthHint}>
                        {t('graph.focus_depth_hint_short', '高亮周围几级关系')}
                      </span>
                    </div>
                    <div
                      className={styles.depthSeg}
                      role="radiogroup"
                      aria-label={t('graph.focus_depth', '展开')}
                    >
                      {GRAPH_FOCUS_DEPTH_OPTIONS.map((d) => {
                        const active = focusDepth === d
                        return (
                          <button
                            key={d}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            className={`${styles.depthBtn} ${active ? styles.depthBtnActive : ''}`}
                            onClick={() => updateFocusDepth(d)}
                          >
                            {d}
                            {t('graph.focus_depth_unit', '级')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>{t('graph.label_name', '名称')}</div>
                    <Input
                      fieldSize="small"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    {editNameConflict ? (
                      <div className={styles.sameNameBanner}>
                        {t(
                          'graph.same_name_exists_edit',
                          '已有同类型同名节点「{{name}}」。保存前请换名，或合并到该节点。',
                          { name: editNameConflict.name }
                        )}
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.linkBtn}
                            onClick={() => void onSelectNode(editNameConflict.id)}
                          >
                            {t('graph.open_existing_node', '打开已有节点')}
                          </button>
                          <button
                            type="button"
                            className={styles.linkBtn}
                            onClick={() =>
                              mergeNodes(editNameConflict.id, selectedNode.id)
                            }
                          >
                            {t('graph.merge_into_existing', '合并到该节点')}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>{t('graph.label_type', '类型')}</div>
                    <div className={styles.detailValue}>
                      {translateGraphNodeType(tr, selectedNode.nodeType)}
                    </div>
                  </div>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>{t('graph.label_summary', '摘要')}</div>
                    <textarea
                      className={styles.editArea}
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>{t('graph.label_aliases', '别名')}</div>
                    <Input
                      fieldSize="small"
                      value={editAliases}
                      onChange={(e) => setEditAliases(e.target.value)}
                      placeholder={t('graph.aliases_placeholder', '逗号分隔')}
                    />
                  </div>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>{t('graph.label_review', '审核')}</div>
                    <div className={styles.detailValue}>
                      {selectedNode.reviewStatus || 'approved'}
                      {selectedNode.origin === 'user'
                        ? ` · ${t('graph.origin_user', '手工修正')}`
                        : ''}
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={busy || !!editNameConflict}
                      onClick={() => void saveNodeEdit()}
                    >
                      {t('graph.save_edit', '保存修改')}
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => void deleteSelectedNode()}
                    >
                      {t('graph.delete_node', '删除节点')}
                    </button>
                  </div>
                  {selectedNode.reviewStatus === 'pending' ? (
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => void reviewNode(selectedNode.id, 'approved')}
                      >
                        {t('graph.approve', '通过')}
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => void reviewNode(selectedNode.id, 'rejected')}
                      >
                        {t('graph.reject', '拒绝')}
                      </button>
                    </div>
                  ) : null}

                  <div className={styles.detailBlock} style={{ marginTop: 16 }}>
                    <div className={styles.detailLabel}>{t('graph.add_edge', '添加关系')}</div>
                    <Input
                      fieldSize="small"
                      value={addEdgeQuery}
                      onChange={(e) => setAddEdgeQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void searchAddEdgeTarget()
                      }}
                      placeholder={t('graph.add_edge_search', '搜索目标节点')}
                    />
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => void searchAddEdgeTarget()}
                      >
                        {t('graph.search', '搜索')}
                      </button>
                      <div className={styles.editSelect}>
                        <Select
                          size="small"
                          value={addEdgeType}
                          aria-label={t('graph.add_edge', '添加关系')}
                          onChange={(e) => setAddEdgeType(e.target.value)}
                          options={(edgeTypes.length ? edgeTypes : ['relates_to']).map((et) => ({
                            value: et,
                            label: translateGraphEdgeType(tr, et)
                          }))}
                        />
                      </div>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        disabled={busy || !addEdgeToId}
                        onClick={() => void addEdge()}
                      >
                        {t('graph.add_edge_submit', '添加')}
                      </button>
                    </div>
                    {addEdgeHits.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        className={`${styles.hitBtn} ${addEdgeToId === h.id ? styles.hitBtnActive : ''}`}
                        onClick={() => setAddEdgeToId(h.id)}
                      >
                        {h.name} · {translateGraphNodeType(tr, h.nodeType)}
                      </button>
                    ))}
                  </div>

                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>
                      {t('graph.local_relations', '直接关系')}
                    </div>
                    <div className={styles.detailValue}>
                      {t('graph.direct_edge_stats', '{{edgeCount}} 条与该节点相连的边', {
                        edgeCount: detailEdges.length
                      })}
                    </div>
                  </div>
                  {detailEdges.length === 0 ? (
                    <div className={styles.empty}>
                      {t('graph.no_direct_edges', '暂无与该节点直接相连的关系')}
                    </div>
                  ) : (
                    detailEdges.map(({ edge: e, partnerName }) => (
                      <div key={e.id} className={styles.item}>
                        <div className={styles.relationPartner}>{partnerName}</div>
                        <div className={styles.itemMeta}>
                          {translateGraphEdgeType(tr, e.edgeType)}
                          {e.reviewStatus === 'pending'
                            ? ` · ${t('graph.pending_badge', '待确认')}`
                            : ''}
                          {e.sourceExcerpt ? ` · ${e.sourceExcerpt}` : ''}
                        </div>
                        <div className={styles.rowActions}>
                          {e.sourceRef || e.sourceExcerpt ? (
                            <button
                              type="button"
                              className={styles.btn}
                              onClick={() => void openSource(e.sourceRef, e.sourceExcerpt)}
                            >
                              {t('graph.open_source', '打开原文')}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={styles.btn}
                            disabled={busy}
                            onClick={() => void deleteEdge(e.id)}
                          >
                            {t('graph.delete_edge', '删除')}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </>
          )}
            </div>
          </>
        )}
      </aside>
        ) : null}
      </div>
      ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <GraphCreateNodeModal
        isOpen={createOpen}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false)
          void refresh().then(() => onSelectNode(id))
        }}
        onOpenExisting={(id) => {
          setCreateOpen(false)
          void onSelectNode(id)
        }}
      />
      <GraphMergeSearchModal
        isOpen={mergeSearchOpen}
        seed={(() => {
          if (!selectedId) return null
          const n = selectedNode?.id === selectedId ? selectedNode : findGraphNode(selectedId)
          if (!n || n.nodeType === 'entry') return null
          return { id: n.id, name: String(n.name || n.id), nodeType: String(n.nodeType || '') }
        })()}
        busy={busy}
        onClose={() => setMergeSearchOpen(false)}
        onRequestMerge={openMergeConfirm}
      />
      <GraphIrreversibleConfirm
        isOpen={!!mergeConfirm}
        title={t('graph.merge_nodes', '合并节点')}
        warning={t(
          'graph.merge_irreversible',
          '合并不可撤销。被合并节点会并入保留节点，关系改挂到保留节点，对端同步后只保留目标节点。'
        )}
        detail={
          mergeConfirm ? (
            <ul className={styles.mergeConfirmList}>
              <li>
                {t('graph.merge_keep', '保留 · {{name}}', {
                  name: mergeConfirm.survivorName
                })}
              </li>
              {mergeConfirm.losers.map((n) => (
                <li key={n.id}>
                  {t('graph.merge_absorb', '并入 · {{name}}', { name: n.name })}
                </li>
              ))}
            </ul>
          ) : null
        }
        busy={busy}
        onCancel={() => setMergeConfirm(null)}
        onConfirm={() => void runConfirmedMerge()}
      />
      <Modal
        isOpen={queueModalOpen && queueItemCount > 0}
        onClose={() => setQueueModalOpen(false)}
        closeOnOverlayClick
        className={styles.queueModal}
        zIndex={1800}
      >
        <div className={styles.queueModalShell}>
          <header className={styles.queueModalHeader}>
            <div className={styles.queueModalHeaderText}>
              <div className={styles.sourceEyebrow}>
                {t('graph.queue_modal_eyebrow', '人生关系图')}
              </div>
              <h2 className={styles.queueModalTitle}>
                {extractRunning
                  ? t('graph.queue_modal_title_running', '正在整理日记')
                  : t('graph.queue_modal_title_done', '整理进度')}
              </h2>
              <p className={styles.queueModalSubtitle}>
                {extractRunning
                  ? t('graph.queue_modal_hint', '关掉窗口不会中断，可继续添加其他日记')
                  : t('graph.queue_modal_progress', '已完成 {{current}} / {{total}} 篇', {
                      current: extractQueue?.completedCount ?? 0,
                      total: queueItemCount
                    })}
              </p>
            </div>
            <button
              type="button"
              className={styles.sourceClose}
              onClick={() => setQueueModalOpen(false)}
              aria-label={t('common.close', '关闭')}
            >
              ×
            </button>
          </header>
          <div className={styles.queueModalOverall}>
            <div className={styles.queueOverallRow}>
              <span className={styles.queueOverallPct}>
                {t('graph.queue_overall_pct', '总进度 {{percent}}%', { percent: queueOverallPct })}
              </span>
              <span>
                {t('graph.queue_modal_progress', '已完成 {{current}} / {{total}} 篇', {
                  current: extractQueue?.completedCount ?? 0,
                  total: queueItemCount
                })}
              </span>
            </div>
            <div className={styles.queueProgress}>
              <div className={styles.queueProgressBar} style={{ width: `${queueOverallPct}%` }} />
            </div>
          </div>
          <div className={styles.queueModalList}>
            {(extractQueue?.items ?? []).map((q) => (
              <div key={q.id} className={styles.queueModalItem}>
                <div className={styles.queueDockItemRow}>
                  <span className={styles.queueDockName}>{q.date || q.filePath}</span>
                  <span
                    className={
                      q.status === 'completed'
                        ? styles.queueBadgeDone
                        : q.status === 'error'
                          ? styles.queueBadgeError
                          : styles.queueBadge
                    }
                  >
                    {q.status === 'running'
                      ? t('graph.queue_running', '抽取中')
                      : q.status === 'aligning'
                        ? t('graph.extract_aligning', '对齐中')
                        : q.status === 'pending'
                          ? t('graph.queue_pending', '排队中')
                          : q.status === 'completed'
                            ? t('graph.queue_done', '已完成')
                            : t('graph.queue_error', '失败')}
                  </span>
                  {q.status === 'pending' || q.status === 'running' || q.status === 'aligning' ? (
                    <button
                      type="button"
                      className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                      onClick={() => void cancelQueueItem(q.filePath)}
                    >
                      {t('graph.queue_remove', '取消')}
                    </button>
                  ) : null}
                </div>
                {q.status === 'running' || q.status === 'aligning' ? (
                  <>
                    <div className={styles.queueProgress}>
                      <div
                        className={styles.queueProgressBar}
                        style={{ width: `${graphExtractBarPercent(q)}%` }}
                      />
                    </div>
                    <div className={styles.queuePhase}>
                      {(() => {
                        const copy = describeGraphExtractPhase(q)
                        return t(copy.key, copy.defaultValue, copy.params)
                      })()}
                    </div>
                  </>
                ) : null}
                {q.status === 'error' && q.error ? (
                  <div className={styles.queueItemError}>
                    {(() => {
                      const copy = describeGraphExtractQueueError(q.error)
                      return t(copy.key, copy.defaultValue, copy.params)
                    })()}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <footer className={styles.queueModalFooter}>
            {extractRunning ? (
              <button type="button" className={styles.btn} onClick={() => void cancelExtract()}>
                {t('graph.stop_extract', '全部停止')}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setQueueModalOpen(false)}
            >
              {extractRunning
                ? t('graph.queue_modal_minimize', '收起，继续整理')
                : t('common.close', '关闭')}
            </button>
          </footer>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(sourcePreview)}
        onClose={() => setSourcePreview(null)}
        closeOnOverlayClick
        className={styles.sourceModal}
        zIndex={2000}
      >
        <div className={styles.sourceShell}>
          <header className={styles.sourceHeader}>
            <div className={styles.sourceHeaderText}>
              <div className={styles.sourceEyebrow}>
                {t('graph.source_preview_eyebrow', '日记原文')}
              </div>
              <h2 className={styles.sourceTitle}>
                {sourcePreview?.date
                  ? sourcePreview.date
                  : t('graph.source_preview_title_generic', '原文')}
              </h2>
            </div>
            <button
              type="button"
              className={styles.sourceClose}
              onClick={() => setSourcePreview(null)}
              aria-label={t('common.close', '关闭')}
            >
              ×
            </button>
          </header>
          <div className={styles.sourceScroll}>
            {sourcePreview?.loading ? (
              <div className={styles.sourceLoading}>{t('graph.source_loading', '加载中…')}</div>
            ) : (
              <>
                {sourcePreview?.excerpt &&
                sourcePreview.excerpt.trim() !== sourcePreview.content.trim() ? (
                  <aside className={styles.sourceExcerpt}>
                    <div className={styles.sourceExcerptLabel}>
                      {t('graph.source_excerpt_label', '关系摘录')}
                    </div>
                    <div className={styles.sourceExcerptText}>{sourcePreview.excerpt}</div>
                  </aside>
                ) : null}
                <div className={styles.sourceMarkdown}>
                  <MarkdownRenderer
                    content={sourcePreview?.content || ''}
                    basePath={sourcePreview?.basePath}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
