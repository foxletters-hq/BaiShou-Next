import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { MdArticle, MdChevronLeft, MdChevronRight, MdSettings } from 'react-icons/md'
import { Search } from 'lucide-react'
import {
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  type UserGender,
  type UserProfile,
  translateGraphEdgeType,
  translateGraphNodeType,
  GRAPH_NODE_TYPE_LABEL_FALLBACKS,
  loadGraphForceSettings,
  saveGraphForceSettings,
  clampGraphForceSettings,
  GRAPH_FORCE_DEFAULTS,
  GRAPH_FORCE_RANGES,
  type GraphForceSettings,
  loadGraphAppearanceSettings,
  saveGraphAppearanceSettings,
  clampGraphAppearanceSettings,
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_APPEARANCE_RANGES,
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
  type GraphFocusDepth
} from '@baishou/shared'
import { MarkdownRenderer, Modal, useDialog, useToast } from '@baishou/ui'
import {
  ensureDesktopGraphSelfName,
  loadDesktopGraphAwakenSelfName,
  saveDesktopGraphAwakenProfile
} from '../diary/utils/ensure-graph-self-name'
import { usePanelResize } from '../agent-workspace/workbench/usePanelResize'
import { GraphAwakenWelcome } from './GraphAwakenWelcome'
import { GraphAwakenBirthdayField } from './GraphAwakenBirthdayField'
import { GraphForceCanvas } from './GraphForceCanvas'
import { GraphMonthRangePicker } from './GraphMonthRangePicker'
import {
  graphGetQueueState,
  graphOnQueueProgress,
  graphQueueExtract,
  graphStopExtract
} from './graph-extract-queue.api'
import styles from './GraphPage.module.css'

type SideTab = 'reextract' | 'pending' | 'detail'
type SideMode = 'content' | 'settings'

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
  estimatedUsdLow: number
  estimatedUsdHigh: number
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

export const GraphPage: React.FC = () => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [localView, setLocalView] = useState<{ nodes: any[]; edges: any[] } | null>(null)
  /** Pending「查看」：忽略月份切片，画布改用邻域子图。 */
  const [pinNeighborhood, setPinNeighborhood] = useState(false)
  const [pendingReextract, setPendingReextract] = useState<any[]>([])
  const [pendingNodes, setPendingNodes] = useState<any[]>([])
  const [pendingEdges, setPendingEdges] = useState<any[]>([])
  const [tab, setTab] = useState<SideTab>('reextract')
  const [sideMode, setSideMode] = useState<SideMode>('content')
  const [busy, setBusy] = useState(false)
  const [extractRunning, setExtractRunning] = useState(false)
  const [status, setStatus] = useState('')
  const queueUnsubRef = useRef<(() => void) | null>(null)
  const [hideEntry, setHideEntry] = useState(true)
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<string>>(
    () => new Set(GRAPH_FILTER_NODE_TYPES)
  )
  const [filterOpen, setFilterOpen] = useState(false)
  const [forceSettings, setForceSettings] = useState<GraphForceSettings>(() => loadGraphForceSettings())
  const [appearanceSettings, setAppearanceSettings] = useState<GraphAppearanceSettings>(() =>
    loadGraphAppearanceSettings()
  )
  const [settingsSection, setSettingsSection] = useState<{
    profile: boolean
    view: boolean
    appearance: boolean
    forces: boolean
  }>({
    profile: false,
    view: true,
    appearance: true,
    forces: true
  })
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
  const filterRef = useRef<HTMLDivElement>(null)
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

  const refresh = useCallback(async () => {
    const graph = await window.api.graph.getGlobalGraph({
      maxNodes: 250,
      monthRange: clampGraphMonthRange(monthRange)
    })
    setNodes(graph.nodes || [])
    setEdges(graph.edges || [])
    setPendingReextract(await window.api.graph.listPendingReextract())
    const pending = await window.api.graph.listPending()
    setPendingNodes(pending.nodes || [])
    setPendingEdges(pending.edges || [])
    try {
      setEstimate(await window.api.graph.estimateExtraction())
    } catch {
      setEstimate(null)
    }
  }, [monthRange])

  const updateMonthRange = (next: GraphMonthRange | Partial<GraphMonthRange>) => {
    const merged = clampGraphMonthRange({ ...monthRange, ...next })
    saveGraphMonthRange(merged)
    setMonthRange(merged)
    setPinNeighborhood(false)
    setLocalView(null)
    setHighlightIds(new Set())
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
  }, [selectedNode])

  useEffect(() => {
    if (!filterOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filterOpen])

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
      if (hideEntry && n.nodeType === 'entry') return false
      if (n.nodeType !== 'entry') {
        const nt = String(n.nodeType || '')
        if (GRAPH_FILTER_NODE_TYPES.includes(nt) && !enabledNodeTypes.has(nt)) return false
      }
      if (
        approvedOnly &&
        n.reviewStatus === 'pending' &&
        !(keepPendingSelected && n.id === selectedId)
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
    pinNeighborhood
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

  const onSearch = async () => {
    const q = query.trim()
    if (!q) {
      setHighlightIds(new Set())
      setLocalView(null)
      return
    }
    const hits = await window.api.graph.search({ query: q, limit: 20 })
    const ids = new Set((hits || []).map((h: any) => h.id as string))
    setHighlightIds(ids)
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
    void onSelectNode(id, { locate: true, bypassMonth: true })
  }

  const locatePendingEdge = async (edge: { fromId: string; toId: string }) => {
    await onSelectNode(edge.fromId, { locate: true, bypassMonth: true })
  }

  const applyQueueSnapshot = useCallback(
    (state: {
      activeCount: number
      pendingCount: number
      runningCount: number
      completedCount: number
      errorCount: number
      items: Array<{ status: string; filePath: string; error?: string }>
    }) => {
      const running = state.activeCount > 0 || state.pendingCount > 0 || state.runningCount > 0
      setExtractRunning(running)
      if (running) {
        const done = state.completedCount
        const total = state.items.length
        const current = Math.min(done + state.runningCount, total)
        setStatus(
          t('graph.extract_queue_progress', '后台整理中 {{current}}/{{total}}（可离开本页）', {
            current,
            total
          })
        )
      } else if (state.completedCount > 0 || state.errorCount > 0) {
        setStatus(
          t('graph.extract_batch_result', '完成 {{done}}，失败 {{failed}}', {
            done: state.completedCount,
            failed: state.errorCount
          })
        )
        void refresh()
      }
    },
    [refresh, t]
  )

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
    return () => {
      cancelled = true
      queueUnsubRef.current?.()
      queueUnsubRef.current = null
    }
  }, [applyQueueSnapshot])

  const runExtract = async (filePaths?: string[]) => {
    const selfName = await ensureDesktopGraphSelfName()
    if (!selfName) {
      setSelfNameReady(false)
      setStatus(t('graph.self_name_required', '请先在关系图谱页完成唤醒后再抽取'))
      return
    }
    setSelfNameReady(true)
    setDismissGuide(true)
    try {
      const result = await graphQueueExtract({ filePaths })
      if (result.queued === 0) {
        setStatus(t('graph.extract_nothing', '没有可抽取的日记'))
        toast.showInfo(t('graph.extract_nothing', '没有可抽取的日记'))
        return
      }
      setExtractRunning(true)
      setStatus(
        t('graph.extract_queued', '已加入后台整理队列（{{count}} 篇），可离开本页', {
          count: result.queued
        })
      )
      toast.showSuccess(
        t('graph.extract_queued', '已加入后台整理队列（{{count}} 篇），可离开本页', {
          count: result.queued
        })
      )
    } catch (e: any) {
      const message = e?.message || String(e)
      setStatus(
        message === GRAPH_SELF_NAME_REQUIRED_ERROR
          ? t('graph.self_name_required', '请先设置图谱自称后再抽取')
          : message
      )
      toast.showError(message)
    }
  }

  const cancelExtract = async () => {
    await graphStopExtract()
    setExtractRunning(false)
    setStatus(t('graph.extract_stopped', '已停止后台整理'))
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
    await refresh()
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
    await refresh()
  }

  const saveNodeEdit = async () => {
    if (!selectedNode) return
    setBusy(true)
    try {
      const aliases = editAliases
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean)
      await window.api.graph.upsertNode({
        id: selectedNode.id,
        name: editName.trim() || selectedNode.name,
        nodeType: selectedNode.nodeType,
        aliases,
        summary: editSummary
      })
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
      t('graph.confirm_delete_node', '确定删除该节点？相关边也会一并软删。'),
      t('graph.delete_node', '删除节点')
    )
    if (!ok) return
    setBusy(true)
    try {
      await window.api.graph.softDelete({ kind: 'node', id: selectedNode.id })
      setSelectedNode(null)
      setSelectedId(null)
      setLocalView(null)
      setPinNeighborhood(false)
      await refresh()
      toast.showSuccess(t('graph.node_deleted', '已删除节点'))
    } catch (e: any) {
      const message = e?.message || String(e)
      setStatus(message)
      toast.showError(message)
    } finally {
      setBusy(false)
    }
  }

  const deleteEdge = async (edgeId: string) => {
    const ok = await dialog.confirm(
      t('graph.confirm_delete_edge', '确定删除这条关系？'),
      t('graph.delete_edge', '删除')
    )
    if (!ok) return
    setBusy(true)
    try {
      await window.api.graph.softDelete({ kind: 'edge', id: edgeId })
      setLocalView((prev) =>
        prev
          ? { ...prev, edges: (prev.edges || []).filter((e: any) => e.id !== edgeId) }
          : prev
      )
      await refresh()
      if (selectedId) {
        const view = await window.api.graph.getView({
          centerNodeId: selectedId,
          depth: viewDepthFor(focusDepth)
        })
        setLocalView(view)
      }
      toast.showSuccess(t('graph.edge_deleted', '已删除关系'))
    } catch (e: any) {
      const message = e?.message || String(e)
      setStatus(message)
      toast.showError(message)
    } finally {
      setBusy(false)
    }
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={phaseTransition}
          >
      <div className={styles.chrome}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.title}>{t('graph.title', '关系图谱')}</div>
          {!showEmptyGuide ? (
            <div className={styles.searchGroup}>
              <div className={styles.searchField}>
                <input
                  className={styles.search}
                  placeholder={t('graph.search_placeholder', '搜索实体 / 别名')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void onSearch()
                  }}
                />
                <button
                  type="button"
                  className={styles.searchBtn}
                  aria-label={t('graph.search', '搜索')}
                  title={t('graph.search', '搜索')}
                  onClick={() => void onSearch()}
                >
                  <Search size={15} strokeWidth={2.25} />
                </button>
              </div>
              <GraphMonthRangePicker
                value={monthRange}
                onChange={updateMonthRange}
                className={styles.toolbarMonth}
              />
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  setPinNeighborhood(false)
                  setLocalView(null)
                  setHighlightIds(new Set())
                  setSelectedId(null)
                  setSelectedNode(null)
                }}
              >
                {t('graph.global_view', '全局')}
              </button>
            </div>
          ) : null}
        </div>
        <div className={styles.toolbarRight}>
          {!showEmptyGuide ? (
            <>
              <div className={styles.filterWrap} ref={filterRef}>
                <button
                  type="button"
                  className={`${styles.btn} ${filterActive ? styles.filterBtnActive : ''}`}
                  aria-expanded={filterOpen}
                  onClick={() => setFilterOpen((v) => !v)}
                >
                  {t('graph.filter', '筛选')}
                </button>
                {filterOpen ? (
                  <>
                    <div
                      className={styles.filterOverlay}
                      onClick={() => setFilterOpen(false)}
                      aria-hidden
                    />
                    <div className={styles.filterPanel} role="dialog" aria-label={t('graph.filter', '筛选')}>
                      <label className={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={hideEntry}
                          onChange={(e) => setHideEntry(e.target.checked)}
                        />
                        {t('graph.hide_entry_anchors', '隐藏日记锚点')}
                      </label>
                      <label className={styles.checkLabel}>
                        <input
                          type="checkbox"
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
                            return (
                              <button
                                key={nodeType}
                                type="button"
                                className={active ? styles.genderChipActive : styles.genderChip}
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
                  </>
                ) : null}
              </div>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={extractRunning || pendingReextract.length === 0}
                onClick={() => void runExtract()}
              >
                {t('graph.process_pending_reextract', '梳理待重抽 ({{count}})', {
                  count: pendingReextract.length
                })}
              </button>
              {extractRunning ? (
                <button type="button" className={styles.btn} onClick={() => void cancelExtract()}>
                  {t('graph.stop_extract', '停止')}
                </button>
              ) : null}
            </>
          ) : extractRunning ? (
            <button type="button" className={styles.btn} onClick={() => void cancelExtract()}>
              {t('graph.stop_extract', '停止')}
            </button>
          ) : null}
        </div>
      </div>

      {status ? (
        <div className={`${styles.statusBar} ${extractRunning || busy ? styles.statusBarBusy : ''}`}>
          {status}
        </div>
      ) : null}
      </div>

      <div className={styles.canvasWrap}>
        {showEmptyGuide ? (
          <div className={styles.emptyGuide}>
            <div className={styles.emptyGuideTitle}>
              {t('graph.empty_guide_title', '还没有开始整理你的关系图谱')}
            </div>
            <div className={styles.emptyGuideBody}>
              {t(
                'graph.empty_guide_body',
                '发现 {{count}} 篇日记可以分析，预计消耗 {{tokens}} tokens（约 {{usdLow}}–{{usdHigh}} USD），用时约 {{minLow}}–{{minHigh}} 分钟。',
                {
                  count: estimate?.entryCount ?? pendingReextract.length,
                  tokens: formatTokens(estimate?.estimatedTokens ?? 0),
                  usdLow: (estimate?.estimatedUsdLow ?? 0).toFixed(2),
                  usdHigh: (estimate?.estimatedUsdHigh ?? 0).toFixed(2),
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
                className={styles.btnPrimary}
                disabled={extractRunning}
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
              {selectedId
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
                    '默认显示近 3 个月的关系；可在上方调整月份范围。'
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
        {sideMode === 'settings' ? (
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
                  onClick={() =>
                    setSettingsSection((s) => ({ ...s, profile: !s.profile }))
                  }
                >
                  <span className={styles.settingsChevron}>
                    {settingsSection.profile ? '▾' : '▸'}
                  </span>
                  {t('graph.profile_section', '身份资料')}
                </button>
                {settingsSection.profile ? (
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
                        <input
                          className={styles.editInput}
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

              <div className={styles.settingsSection}>
                <button
                  type="button"
                  className={styles.settingsSectionHead}
                  onClick={() => setSettingsSection((s) => ({ ...s, view: !s.view }))}
                >
                  <span className={styles.settingsChevron}>
                    {settingsSection.view ? '▾' : '▸'}
                  </span>
                  {t('graph.view_section', '浏览')}
                </button>
                {settingsSection.view ? (
                  <div className={styles.settingsSectionBody}>
                    <div className={styles.viewField}>
                      <div className={styles.viewFieldLabel}>
                        {t('graph.month_range', '月份范围')}
                      </div>
                      <p className={styles.viewFieldHint}>
                        {t(
                          'graph.month_range_hint',
                          '按日记关系所属月份筛选画布上的节点与连线'
                        )}
                      </p>
                      <GraphMonthRangePicker
                        block
                        value={monthRange}
                        onChange={(next) => updateMonthRange(next)}
                      />
                    </div>
                    <div className={styles.viewField}>
                      <div className={styles.viewFieldLabel}>
                        {t('graph.focus_depth', '展开等级')}
                      </div>
                      <p className={styles.viewFieldHint}>
                        {t(
                          'graph.focus_depth_hint',
                          '选中节点后，高亮其周围几级关系（1=直接相连，2=再扩一层）'
                        )}
                      </p>
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
                  </div>
                ) : null}
              </div>

              <div className={styles.settingsSection}>
                <button
                  type="button"
                  className={styles.settingsSectionHead}
                  onClick={() =>
                    setSettingsSection((s) => ({ ...s, appearance: !s.appearance }))
                  }
                >
                  <span className={styles.settingsChevron}>
                    {settingsSection.appearance ? '▾' : '▸'}
                  </span>
                  {t('graph.appearance', '外观')}
                </button>
                {settingsSection.appearance ? (
                  <div className={styles.settingsSectionBody}>
                    <label className={styles.settingsToggleRow}>
                      <span>{t('graph.show_arrows', '箭头')}</span>
                      <input
                        type="checkbox"
                        checked={appearanceSettings.showArrows}
                        onChange={(e) => updateAppearance({ showArrows: e.target.checked })}
                      />
                    </label>
                    <label className={styles.settingsSliderRow}>
                      <span className={styles.settingsSliderLabel}>
                        {t('graph.text_opacity', '文本透明度')}
                      </span>
                      <span className={styles.forceValue}>
                        {appearanceSettings.textOpacity.toFixed(2)}
                      </span>
                      <input
                        type="range"
                        min={GRAPH_APPEARANCE_RANGES.textOpacity.min}
                        max={GRAPH_APPEARANCE_RANGES.textOpacity.max}
                        step={GRAPH_APPEARANCE_RANGES.textOpacity.step}
                        value={appearanceSettings.textOpacity}
                        onChange={(e) =>
                          updateAppearance({ textOpacity: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className={styles.settingsSliderRow}>
                      <span className={styles.settingsSliderLabel}>
                        {t('graph.node_size', '节点大小')}
                      </span>
                      <span className={styles.forceValue}>
                        {appearanceSettings.nodeSize.toFixed(2)}
                      </span>
                      <input
                        type="range"
                        min={GRAPH_APPEARANCE_RANGES.nodeSize.min}
                        max={GRAPH_APPEARANCE_RANGES.nodeSize.max}
                        step={GRAPH_APPEARANCE_RANGES.nodeSize.step}
                        value={appearanceSettings.nodeSize}
                        onChange={(e) =>
                          updateAppearance({ nodeSize: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className={styles.settingsSliderRow}>
                      <span className={styles.settingsSliderLabel}>
                        {t('graph.line_thickness', '连线粗细')}
                      </span>
                      <span className={styles.forceValue}>
                        {appearanceSettings.lineThickness.toFixed(2)}
                      </span>
                      <input
                        type="range"
                        min={GRAPH_APPEARANCE_RANGES.lineThickness.min}
                        max={GRAPH_APPEARANCE_RANGES.lineThickness.max}
                        step={GRAPH_APPEARANCE_RANGES.lineThickness.step}
                        value={appearanceSettings.lineThickness}
                        onChange={(e) =>
                          updateAppearance({ lineThickness: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className={styles.settingsSliderRow}>
                      <span className={styles.settingsSliderLabel}>
                        {t('graph.hub_label_degree', '显名边数')}
                      </span>
                      <span className={styles.forceValue}>
                        {appearanceSettings.hubLabelMinDegree}
                      </span>
                      <input
                        type="range"
                        min={GRAPH_APPEARANCE_RANGES.hubLabelMinDegree.min}
                        max={GRAPH_APPEARANCE_RANGES.hubLabelMinDegree.max}
                        step={GRAPH_APPEARANCE_RANGES.hubLabelMinDegree.step}
                        value={appearanceSettings.hubLabelMinDegree}
                        onChange={(e) =>
                          updateAppearance({ hubLabelMinDegree: Number(e.target.value) })
                        }
                        title={t(
                          'graph.hub_label_degree_hint',
                          '连接边超过该数量时，全局视图默认显示名称'
                        )}
                      />
                    </label>
                    <label className={styles.settingsSliderRow}>
                      <span className={styles.settingsSliderLabel}>
                        {t('graph.hub_label_mentions', '显名提及')}
                      </span>
                      <span className={styles.forceValue}>
                        {appearanceSettings.hubLabelMinMentions}
                      </span>
                      <input
                        type="range"
                        min={GRAPH_APPEARANCE_RANGES.hubLabelMinMentions.min}
                        max={GRAPH_APPEARANCE_RANGES.hubLabelMinMentions.max}
                        step={GRAPH_APPEARANCE_RANGES.hubLabelMinMentions.step}
                        value={appearanceSettings.hubLabelMinMentions}
                        onChange={(e) =>
                          updateAppearance({ hubLabelMinMentions: Number(e.target.value) })
                        }
                        title={t(
                          'graph.hub_label_mentions_hint',
                          '提及次数达到该值时，全局视图默认显示名称'
                        )}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => setAnimationTick((n) => n + 1)}
                      title={t(
                        'graph.replay_layout_hint',
                        '给节点一点扰动，重新跑一遍力导向布局'
                      )}
                    >
                      {t('graph.replay_layout', '重新布局')}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className={styles.settingsSection}>
                <button
                  type="button"
                  className={styles.settingsSectionHead}
                  onClick={() => setSettingsSection((s) => ({ ...s, forces: !s.forces }))}
                >
                  <span className={styles.settingsChevron}>
                    {settingsSection.forces ? '▾' : '▸'}
                  </span>
                  {t('graph.forces', '力度')}
                </button>
                {settingsSection.forces ? (
                  <div className={styles.settingsSectionBody}>
                    <label className={styles.settingsSliderRow}>
                      <span className={styles.settingsSliderLabel}>
                        {t('graph.force_center', '图谱向心力')}
                      </span>
                      <span className={styles.forceValue}>
                        {forceSettings.centerStrength.toFixed(2)}
                      </span>
                      <input
                        type="range"
                        min={GRAPH_FORCE_RANGES.centerStrength.min}
                        max={GRAPH_FORCE_RANGES.centerStrength.max}
                        step={GRAPH_FORCE_RANGES.centerStrength.step}
                        value={forceSettings.centerStrength}
                        onChange={(e) =>
                          updateForce({ centerStrength: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className={styles.settingsSliderRow}>
                      <span className={styles.settingsSliderLabel}>
                        {t('graph.force_charge', '节点排斥力')}
                      </span>
                      <span className={styles.forceValue}>
                        {Math.abs(forceSettings.chargeStrength)}
                      </span>
                      <input
                        type="range"
                        min={GRAPH_FORCE_RANGES.chargeStrength.min}
                        max={GRAPH_FORCE_RANGES.chargeStrength.max}
                        step={GRAPH_FORCE_RANGES.chargeStrength.step}
                        value={forceSettings.chargeStrength}
                        onChange={(e) =>
                          updateForce({ chargeStrength: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className={styles.settingsSliderRow}>
                      <span className={styles.settingsSliderLabel}>
                        {t('graph.force_link', '相连吸引力')}
                      </span>
                      <span className={styles.forceValue}>
                        {forceSettings.linkStrength.toFixed(2)}
                      </span>
                      <input
                        type="range"
                        min={GRAPH_FORCE_RANGES.linkStrength.min}
                        max={GRAPH_FORCE_RANGES.linkStrength.max}
                        step={GRAPH_FORCE_RANGES.linkStrength.step}
                        value={forceSettings.linkStrength}
                        onChange={(e) =>
                          updateForce({ linkStrength: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className={styles.settingsSliderRow}>
                      <span className={styles.settingsSliderLabel}>
                        {t('graph.force_link_distance', '连线长度')}
                      </span>
                      <span className={styles.forceValue}>{forceSettings.linkDistance}</span>
                      <input
                        type="range"
                        min={GRAPH_FORCE_RANGES.linkDistance.min}
                        max={GRAPH_FORCE_RANGES.linkDistance.max}
                        step={GRAPH_FORCE_RANGES.linkDistance.step}
                        value={forceSettings.linkDistance}
                        onChange={(e) =>
                          updateForce({ linkDistance: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                ) : null}
              </div>
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
                        <button
                          type="button"
                          className={styles.linkBtn}
                          disabled={extractRunning}
                          onClick={() => void runExtract([item.filePath])}
                        >
                          {t('graph.extract_short', '抽取')}
                        </button>
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
                  <p className={styles.pendingHint}>
                    {t(
                      'graph.pending_hint',
                      '确认关系会同时通过两端节点；确认节点也会通过与它相连的待审关系。'
                    )}
                  </p>
                  {pendingNodes.map((node) => (
                    <div key={`n-${node.id}`} className={styles.itemCompact}>
                      <div className={styles.itemRow}>
                        <div className={styles.itemTitle}>
                          {t('graph.pending_node', '节点')} · {node.name}
                        </div>
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
                          {translateGraphNodeType(t, node.nodeType)}
                          {node.summary ? ` · ${node.summary}` : ''}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {pendingEdges.map((edge) => {
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
                          <div className={styles.itemTitle}>
                            {t('graph.pending_edge', '关系')} ·{' '}
                            {translateGraphEdgeType(t, edge.edgeType)}
                          </div>
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
                    <input
                      className={styles.editInput}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailLabel}>{t('graph.label_type', '类型')}</div>
                    <div className={styles.detailValue}>
                      {translateGraphNodeType(t, selectedNode.nodeType)}
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
                    <input
                      className={styles.editInput}
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
                      disabled={busy}
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
                    <input
                      className={styles.editInput}
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
                      <select
                        className={styles.editSelect}
                        value={addEdgeType}
                        onChange={(e) => setAddEdgeType(e.target.value)}
                      >
                        {(edgeTypes.length ? edgeTypes : ['relates_to']).map((et) => (
                          <option key={et} value={et}>
                            {translateGraphEdgeType(t, et)}
                          </option>
                        ))}
                      </select>
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
                        {h.name} · {translateGraphNodeType(t, h.nodeType)}
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
                          {translateGraphEdgeType(t, e.edgeType)}
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
