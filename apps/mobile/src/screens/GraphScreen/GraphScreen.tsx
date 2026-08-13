import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Switch,
  Animated,
  ScrollView,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  FloatingModal,
  Input,
  MarkdownRenderer,
  NativeSlider,
  useNativeTheme,
  useNativeToast
} from '@baishou/ui/native'
import {
  deriveLegacyVaultId,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  parseDateStr,
  translateGraphEdgeType,
  translateGraphNodeType,
  GRAPH_NODE_TYPE_LABEL_FALLBACKS,
  loadGraphForceSettings,
  saveGraphForceSettings,
  clampGraphForceSettings,
  GRAPH_FORCE_DEFAULTS,
  GRAPH_FORCE_RANGES,
  GRAPH_FORCE_STORAGE_KEY,
  type GraphForceSettings,
  clampGraphAppearanceSettings,
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_APPEARANCE_RANGES,
  GRAPH_APPEARANCE_STORAGE_KEY,
  type GraphAppearanceSettings,
  defaultGraphMonthRange,
  clampGraphMonthRange,
  isDefaultGraphMonthRange,
  formatGraphMonth,
  parseGraphMonthToDate,
  GRAPH_MONTH_RANGE_STORAGE_KEY,
  type GraphMonthRange,
  clampGraphFocusDepth,
  collectGraphFocusIds,
  GRAPH_FOCUS_DEPTH_OPTIONS,
  GRAPH_FOCUS_DEPTH_STORAGE_KEY,
  type GraphFocusDepth,
  USER_GENDER_OPTIONS,
  validateGraphAwakenForm,
  isDefaultGraphSelfName,
  type UserGender,
  type UserProfile
} from '@baishou/shared'
import { GRAPH_EDGE_TYPES, ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  mobileEstimateExtraction,
  mobileGetNode,
  mobileGetView,
  mobileListPending,
  mobileListPendingReextract,
  mobileLoadGlobalGraph,
  mobileSearchGraphNodes,
  mobileSetEdgeReview,
  mobileSetNodeReview,
  mobileSoftDeleteGraph,
  mobileUpsertEdge,
  mobileUpsertNode
} from '@/src/services/mobile-graph.service'
import {
  mobileGraphExtractQueue,
  type GraphExtractQueueSnapshot
} from '@/src/services/mobile-graph-extract-queue.service'
import {
  ensureMobileGraphSelfName,
  loadMobileGraphAwakenSelfName,
  saveMobileGraphAwakenProfile
} from '../DiaryScreen/ensure-graph-self-name'
import { GraphAwakenWelcome } from './GraphAwakenWelcome'
import { GraphMonthRangeSheet } from './GraphMonthRangeSheet'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { GraphForceWebView } from './GraphForceWebView'

type Tab = 'graph' | 'search' | 'reextract' | 'pending'

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
  loading: boolean
}

type PendingItem = { kind: 'node'; id: string; data: any } | { kind: 'edge'; id: string; data: any }

const GRAPH_FILTER_NODE_TYPES = Object.keys(GRAPH_NODE_TYPE_LABEL_FALLBACKS).filter(
  (t) => t !== 'entry'
)

function GraphPhaseFade({ children, phaseKey }: { children: React.ReactNode; phaseKey: string }) {
  const opacity = React.useRef(new Animated.Value(0)).current
  const translateY = React.useRef(new Animated.Value(10)).current

  React.useEffect(() => {
    opacity.setValue(0)
    translateY.setValue(10)
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start()
  }, [phaseKey, opacity, translateY])

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  )
}

function viewDepthFor(depth: GraphFocusDepth): 1 | 2 | 3 {
  return depth === 3 ? 3 : depth === 2 ? 2 : 1
}

export function GraphScreen() {
  const { t } = useTranslation()
  const tr = useCallback((key: string, defaultValue?: string) => t(key, defaultValue ?? ''), [t])
  const { colors } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()
  const toast = useNativeToast()
  const insets = useSafeAreaInsets()
  const chrome = getStackScreenChrome(colors)
  const { services, dbReady } = useBaishou()
  const [tab, setTab] = useState<Tab>('graph')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [pendingNodes, setPendingNodes] = useState<any[]>([])
  const [pendingEdges, setPendingEdges] = useState<any[]>([])
  const [graphNodes, setGraphNodes] = useState<any[]>([])
  const [graphEdges, setGraphEdges] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [localView, setLocalView] = useState<{ nodes: any[]; edges: any[] } | null>(null)
  const [pinNeighborhood, setPinNeighborhood] = useState(false)
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  const [hideEntry, setHideEntry] = useState(true)
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<string>>(
    () => new Set(GRAPH_FILTER_NODE_TYPES)
  )
  const [filterOpen, setFilterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState({
    profile: false,
    view: true,
    appearance: true,
    forces: true
  })
  const [focusDepth, setFocusDepth] = useState<GraphFocusDepth>(1)
  const [locateSeq, setLocateSeq] = useState(0)
  const [animationTick, setAnimationTick] = useState(0)
  const [editName, setEditName] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editAliases, setEditAliases] = useState('')
  const [addEdgeQuery, setAddEdgeQuery] = useState('')
  const [addEdgeHits, setAddEdgeHits] = useState<any[]>([])
  const [addEdgeToId, setAddEdgeToId] = useState('')
  const [addEdgeType, setAddEdgeType] = useState<string>(GRAPH_EDGE_TYPES[0] ?? 'relates_to')
  const [busy, setBusy] = useState(false)
  const [extractRunning, setExtractRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [forceSettings, setForceSettings] = useState<GraphForceSettings>(() => loadGraphForceSettings())
  const [appearanceSettings, setAppearanceSettings] = useState<GraphAppearanceSettings>(() =>
    clampGraphAppearanceSettings(GRAPH_APPEARANCE_DEFAULTS)
  )
  const [monthRange, setMonthRange] = useState<GraphMonthRange>(() => defaultGraphMonthRange())
  const [dismissGuide, setDismissGuide] = useState(false)
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [sourcePreview, setSourcePreview] = useState<SourcePreview | null>(null)
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

  const activeVault = services?.vaultService.getActiveVault()
  const vaultName = activeVault?.name || 'Personal'
  const vaultId = activeVault?.id ?? deriveLegacyVaultId(vaultName)

  const pendingItems: PendingItem[] = useMemo(
    () => [
      ...pendingNodes.map((n) => ({ kind: 'node' as const, id: n.id, data: n })),
      ...pendingEdges.map((e) => ({ kind: 'edge' as const, id: e.id, data: e }))
    ],
    [pendingNodes, pendingEdges]
  )

  const tabItems = useMemo(
    () =>
      [
        ['graph', t('graph.tab_graph', '图谱')],
        ['reextract', `${t('graph.tab_reextract', '待重抽')}(${pending.length})`],
        ['pending', `${t('graph.tab_pending', '待确认')}(${pendingItems.length})`],
        ['search', t('graph.tab_search', '搜索')]
      ] as const,
    [t, pending.length, pendingItems.length]
  )

  const refresh = useCallback(async () => {
    if (!services || !dbReady) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId)
    setPending(
      await mobileListPendingReextract({
        vaultName,
        shadowRepo,
        pathService: services.pathService,
        fileSystem: services.fileSystem
      })
    )
    const pendingBundle = await mobileListPending(runtime.drizzleDb, vaultId)
    setPendingNodes(pendingBundle.nodes)
    setPendingEdges(pendingBundle.edges)
    const graph = await mobileLoadGlobalGraph(
      runtime.drizzleDb,
      vaultId,
      120,
      clampGraphMonthRange(monthRange)
    )
    setGraphNodes(graph.nodes)
    setGraphEdges(graph.edges)
    try {
      setEstimate(
        await mobileEstimateExtraction({
          vaultName,
          shadowRepo,
          pathService: services.pathService,
          fileSystem: services.fileSystem
        })
      )
    } catch {
      setEstimate(null)
    }
  }, [services, dbReady, vaultName, vaultId, monthRange])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(GRAPH_FORCE_STORAGE_KEY)
        if (cancelled || !raw) return
        setForceSettings(clampGraphForceSettings(JSON.parse(raw) as Partial<GraphForceSettings>))
      } catch {
        // ignore corrupt / storage errors
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(GRAPH_MONTH_RANGE_STORAGE_KEY)
        if (cancelled || !raw) return
        setMonthRange(clampGraphMonthRange(JSON.parse(raw) as Partial<GraphMonthRange>))
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(GRAPH_APPEARANCE_STORAGE_KEY)
        if (cancelled || !raw) return
        setAppearanceSettings(
          clampGraphAppearanceSettings(JSON.parse(raw) as Partial<GraphAppearanceSettings>)
        )
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

  const updateMonthRange = useCallback(
    (next: GraphMonthRange | Partial<GraphMonthRange>) => {
      const merged = clampGraphMonthRange({ ...monthRange, ...next })
      setMonthRange(merged)
      void AsyncStorage.setItem(GRAPH_MONTH_RANGE_STORAGE_KEY, JSON.stringify(merged))
      setPinNeighborhood(false)
      setLocalView(null)
      setHighlightIds(new Set())
      setSelectedId(null)
      setSelectedNode(null)
    },
    [monthRange]
  )

  const resetMonthRange = useCallback(() => {
    updateMonthRange(defaultGraphMonthRange())
  }, [updateMonthRange])

  useEffect(() => {
    if (selfNameReady !== true) return
    void refresh().catch((e) => setStatus(String(e?.message || e)))
  }, [refresh, selfNameReady])

  useEffect(() => {
    if (!services || !dbReady) return
    let cancelled = false
    void (async () => {
      try {
        const state = await loadMobileGraphAwakenSelfName(services.settingsManager)
        if (cancelled) return
        setAwakenProfile(state.profile)
        setSelfNameReady(state.ready)
      } catch {
        if (!cancelled) setSelfNameReady(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [services, dbReady])

  useEffect(() => {
    if (!selectedNode) return
    setEditName(selectedNode.name || '')
    setEditSummary(selectedNode.summary || '')
    setEditAliases(Array.isArray(selectedNode.aliases) ? selectedNode.aliases.join(', ') : '')
    setAddEdgeQuery('')
    setAddEdgeHits([])
    setAddEdgeToId('')
    setAddEdgeType('relates_to')
  }, [selectedNode])

  useEffect(() => {
    if (!awakenProfile) return
    const nick = awakenProfile.nickname?.trim() ?? ''
    setProfileForm({
      nickname: isDefaultGraphSelfName(nick) ? '' : nick,
      birthday: awakenProfile.birthday?.trim() || '',
      gender: (awakenProfile.gender as UserGender | undefined) || ''
    })
  }, [awakenProfile])

  const canvasNodeCount = graphNodes.filter((n) => n.reviewStatus !== 'rejected').length
  const showAwakenGate = selfNameReady === false
  const awakenPending = selfNameReady === null
  const showEmptyGuide =
    selfNameReady === true &&
    !dismissGuide &&
    canvasNodeCount === 0 &&
    (estimate?.entryCount ?? pending.length) > 0 &&
    isDefaultGraphMonthRange(monthRange)

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

    if (pinNeighborhood && localView?.nodes?.length) {
      return localView.nodes.filter((n) => filterNode(n, true))
    }

    const base = graphNodes.filter((n) => filterNode(n, true))
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
    graphNodes,
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
      : selectedId && !graphNodes.some((n) => n.id === selectedId)
        ? [...graphEdges, ...(localView?.edges || [])]
        : graphEdges
    return source.filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      if (e.reviewStatus === 'rejected') return false
      if (!pinNeighborhood && approvedOnly && e.reviewStatus === 'pending') return false
      return idSet.has(e.fromId) && idSet.has(e.toId)
    })
  }, [displayNodes, graphEdges, approvedOnly, localView, selectedId, graphNodes, pinNeighborhood])

  const focusIds = useMemo(() => {
    if (!selectedId) return undefined
    return collectGraphFocusIds(selectedId, displayEdges, focusDepth)
  }, [selectedId, displayEdges, focusDepth])

  const showMonthEmpty =
    selfNameReady === true && !showEmptyGuide && displayNodes.length === 0 && !pinNeighborhood

  const detailEdges = useMemo(() => {
    if (!selectedId) return []
    const nodeById = new Map(
      (localView?.nodes || graphNodes).map((n: any) => [n.id as string, n])
    )
    const seen = new Set<string>()
    const list: Array<{ edge: any; partnerName: string }> = []
    const edgeSource = localView?.edges?.length ? localView.edges : graphEdges
    for (const e of edgeSource) {
      if (e.fromId !== selectedId && e.toId !== selectedId) continue
      if (seen.has(e.id)) continue
      seen.add(e.id)
      if (e.reviewStatus === 'rejected') continue
      const partnerId = e.fromId === selectedId ? e.toId : e.fromId
      const partner = nodeById.get(partnerId) || graphNodes.find((n: any) => n.id === partnerId)
      list.push({
        edge: e,
        partnerName: partner?.name || String(partnerId).slice(0, 8)
      })
    }
    return list
  }, [localView, selectedId, graphNodes, graphEdges])

  const updateForce = useCallback((patch: Partial<GraphForceSettings>) => {
    setForceSettings((prev) => {
      const next = clampGraphForceSettings({ ...prev, ...patch })
      saveGraphForceSettings(next)
      void AsyncStorage.setItem(GRAPH_FORCE_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const updateAppearance = useCallback((patch: Partial<GraphAppearanceSettings>) => {
    setAppearanceSettings((prev) => {
      const next = clampGraphAppearanceSettings({ ...prev, ...patch })
      void AsyncStorage.setItem(GRAPH_APPEARANCE_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const resetGraphSettings = useCallback(() => {
    const force = { ...GRAPH_FORCE_DEFAULTS }
    const appearance = clampGraphAppearanceSettings(GRAPH_APPEARANCE_DEFAULTS)
    setForceSettings(force)
    saveGraphForceSettings(force)
    void AsyncStorage.setItem(GRAPH_FORCE_STORAGE_KEY, JSON.stringify(force))
    setAppearanceSettings(appearance)
    void AsyncStorage.setItem(GRAPH_APPEARANCE_STORAGE_KEY, JSON.stringify(appearance))
  }, [])

  const updateFocusDepth = useCallback(
    (depth: GraphFocusDepth) => {
      const next = persistFocusDepth(depth)
      if (pinNeighborhood && selectedId) {
        void (async () => {
          const runtime = getAgentDbRuntime()
          if (!runtime?.drizzleDb) return
          const view = await mobileGetView(runtime.drizzleDb, vaultId, {
            centerNodeId: selectedId,
            depth: viewDepthFor(next)
          })
          setLocalView(view)
          setLocateSeq((n) => n + 1)
        })()
      }
    },
    [persistFocusDepth, pinNeighborhood, selectedId, vaultId]
  )

  const completeAwaken = async (fields: {
    nickname: string
    birthday: string
    gender: UserGender
  }) => {
    if (!services) return
    setAwakenBusy(true)
    try {
      await saveMobileGraphAwakenProfile(services.settingsManager, fields)
      setSelfNameReady(true)
      setAwakenProfile((prev) =>
        prev
          ? { ...prev, nickname: fields.nickname, birthday: fields.birthday, gender: fields.gender }
          : ({
              nickname: fields.nickname,
              birthday: fields.birthday,
              gender: fields.gender
            } as UserProfile)
      )
      setStatus('')
    } catch (e: any) {
      setStatus(String(e?.message || e))
      toast.showError(String(e?.message || e))
    } finally {
      setAwakenBusy(false)
    }
  }

  const syncSelfPersonNode = async (oldName: string, newName: string) => {
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb || !services) return false
    const prev = oldName.trim()
    const next = newName.trim()
    if (!prev || !next || prev === next) return false
    const hits = await mobileSearchGraphNodes(runtime.drizzleDb, vaultId, prev)
    const match = (hits || [])
      .filter((h: any) => h.nodeType === 'person')
      .find((h: any) => {
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
    await mobileUpsertNode({
      drizzleDb: runtime.drizzleDb,
      pathService: services.pathService,
      fileSystem: services.fileSystem,
      vaultId,
      vaultDisplayName: vaultName,
      id: match.id,
      name: next,
      nodeType: 'person',
      aliases: [...aliases],
      summary: match.summary || undefined
    })
    return true
  }

  const saveProfileFromSettings = async () => {
    if (!services) return
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
      await saveMobileGraphAwakenProfile(services.settingsManager, fields)
      const synced = await syncSelfPersonNode(oldName, fields.nickname)
      setAwakenProfile((prev) =>
        prev
          ? { ...prev, nickname: fields.nickname, birthday: fields.birthday, gender: fields.gender }
          : ({
              nickname: fields.nickname,
              birthday: fields.birthday,
              gender: fields.gender
            } as UserProfile)
      )
      setSelfNameReady(true)
      await refresh()
      if (selectedId) {
        const runtime = getAgentDbRuntime()
        if (runtime?.drizzleDb) {
          const view = await mobileGetView(runtime.drizzleDb, vaultId, {
            centerNodeId: selectedId,
            depth: viewDepthFor(focusDepth)
          })
          setLocalView(view)
          if (selectedNode?.id === selectedId) {
            const node = await mobileGetNode(runtime.drizzleDb, vaultId, selectedId)
            setSelectedNode(node)
          }
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

  const onSelectNode = async (
    id: string,
    opts?: { locate?: boolean; bypassMonth?: boolean }
  ) => {
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    let depthSetting = focusDepth
    if (opts?.bypassMonth && focusDepth < 2) {
      depthSetting = 2
      persistFocusDepth(2)
    }
    const depth = viewDepthFor(depthSetting)
    const node = await mobileGetNode(runtime.drizzleDb, vaultId, id)
    const view = await mobileGetView(runtime.drizzleDb, vaultId, {
      centerNodeId: id,
      depth
    })
    setSelectedId(id)
    setSelectedNode(node)
    setLocalView(view)
    if (opts?.bypassMonth) setPinNeighborhood(true)
    setTab('graph')
    if (opts?.locate || opts?.bypassMonth) setLocateSeq((n) => n + 1)
  }

  const clearSelectionKeepPin = () => {
    setSelectedId(null)
    setSelectedNode(null)
    setHighlightIds(new Set())
  }

  const clearToGlobal = () => {
    setPinNeighborhood(false)
    setLocalView(null)
    setHighlightIds(new Set())
    setSelectedId(null)
    setSelectedNode(null)
  }

  const locatePendingNode = (id: string) => {
    void onSelectNode(id, { locate: true, bypassMonth: true })
  }

  const locatePendingEdge = async (edge: { fromId: string; toId: string }) => {
    await onSelectNode(edge.fromId, { locate: true, bypassMonth: true })
  }

  const onSearch = async () => {
    const runtime = getAgentDbRuntime()
    const q = query.trim()
    if (!runtime?.drizzleDb || !q) {
      setHits([])
      setHighlightIds(new Set())
      return
    }
    const found = await mobileSearchGraphNodes(runtime.drizzleDb, vaultId, q)
    setHits(found)
    if (found?.[0]) {
      const hit = found[0]
      setTab('graph')
      setSelectedId(hit.id)
      setHighlightIds(new Set([hit.id]))
      const view = await mobileGetView(runtime.drizzleDb, vaultId, {
        centerNodeId: hit.id,
        depth: viewDepthFor(focusDepth)
      })
      setLocalView(view)
      setPinNeighborhood(false)
      const node = await mobileGetNode(runtime.drizzleDb, vaultId, hit.id)
      setSelectedNode(node || hit)
      setLocateSeq((n) => n + 1)
    }
  }

  const onSearchHitPress = async (item: any) => {
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    setTab('graph')
    setSelectedId(item.id)
    setHighlightIds(new Set([item.id]))
    const view = await mobileGetView(runtime.drizzleDb, vaultId, {
      centerNodeId: item.id,
      depth: viewDepthFor(focusDepth)
    })
    setLocalView(view)
    setPinNeighborhood(false)
    const node = await mobileGetNode(runtime.drizzleDb, vaultId, item.id)
    setSelectedNode(node || item)
    setLocateSeq((n) => n + 1)
  }

  const applyQueueSnapshot = useCallback(
    (state: GraphExtractQueueSnapshot) => {
      const running = state.activeCount > 0 || state.pendingCount > 0 || state.runningCount > 0
      setExtractRunning(running)
      if (running) {
        const total = state.items.length
        const current = Math.min(state.completedCount + state.runningCount, total)
        setStatus(
          t('graph.extract_queue_progress', '后台整理中 {{current}}/{{total}}（可离开本页）', {
            current,
            total
          })
        )
      } else if (state.completedCount > 0 || state.errorCount > 0) {
        setStatus(
          t('graph.extract_done', '完成 {{done}}，失败 {{failed}}', {
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
    return mobileGraphExtractQueue.subscribe(applyQueueSnapshot)
  }, [applyQueueSnapshot])

  const runExtract = async (filePaths?: string[]) => {
    if (!services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const selfName = await ensureMobileGraphSelfName({
      settingsManager: services.settingsManager
    })
    if (!selfName) {
      setSelfNameReady(false)
      setStatus(t('graph.self_name_required', '请先在关系图谱页完成唤醒后再抽取'))
      toast.showError(t('graph.self_name_required', '请先在关系图谱页完成唤醒后再抽取'))
      return
    }
    setSelfNameReady(true)
    setDismissGuide(true)
    try {
      const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId)
      const result = await mobileGraphExtractQueue.enqueue(
        { filePaths },
        {
          vaultId,
          vaultName,
          drizzleDb: runtime.drizzleDb,
          shadowRepo,
          pathService: services.pathService,
          fileSystem: services.fileSystem,
          settingsManager: services.settingsManager
        }
      )
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

  const stopExtract = () => {
    mobileGraphExtractQueue.stop()
    setExtractRunning(false)
    setStatus(t('graph.extract_stopped', '已停止后台整理'))
  }

  const reviewEdge = async (
    edgeId: string,
    reviewStatus: 'approved' | 'rejected',
    endpoints?: { fromId?: string; toId?: string }
  ) => {
    if (!services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    await mobileSetEdgeReview({
      drizzleDb: runtime.drizzleDb,
      pathService: services.pathService,
      fileSystem: services.fileSystem,
      edgeId,
      reviewStatus,
      vaultDisplayName: vaultName
    })
    if (reviewStatus === 'approved') {
      const pendingEnds = [endpoints?.fromId, endpoints?.toId].filter(Boolean) as string[]
      for (const nodeId of pendingEnds) {
        const node =
          pendingNodes.find((n) => n.id === nodeId) ||
          graphNodes.find((n) => n.id === nodeId && n.reviewStatus === 'pending')
        if (node) {
          await mobileSetNodeReview({
            drizzleDb: runtime.drizzleDb,
            pathService: services.pathService,
            fileSystem: services.fileSystem,
            nodeId,
            reviewStatus: 'approved',
            vaultDisplayName: vaultName
          })
        }
      }
    }
    await refresh()
  }

  const reviewNode = async (nodeId: string, reviewStatus: 'approved' | 'rejected') => {
    if (!services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    await mobileSetNodeReview({
      drizzleDb: runtime.drizzleDb,
      pathService: services.pathService,
      fileSystem: services.fileSystem,
      nodeId,
      reviewStatus,
      vaultDisplayName: vaultName
    })
    if (reviewStatus === 'approved') {
      const incident = pendingEdges.filter((e) => e.fromId === nodeId || e.toId === nodeId)
      for (const edge of incident) {
        await mobileSetEdgeReview({
          drizzleDb: runtime.drizzleDb,
          pathService: services.pathService,
          fileSystem: services.fileSystem,
          edgeId: edge.id,
          reviewStatus: 'approved',
          vaultDisplayName: vaultName
        })
      }
    }
    await refresh()
  }

  const saveNodeEdit = async () => {
    if (!services || !selectedNode) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const name = editName.trim()
    if (!name) return
    setBusy(true)
    try {
      const aliases = editAliases
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean)
      await mobileUpsertNode({
        drizzleDb: runtime.drizzleDb,
        pathService: services.pathService,
        fileSystem: services.fileSystem,
        vaultId,
        vaultDisplayName: vaultName,
        id: selectedNode.id,
        name,
        nodeType: selectedNode.nodeType,
        aliases,
        summary: editSummary
      })
      setStatus(t('graph.edit_saved', '已保存（手工修正，重抽不会覆盖）'))
      toast.showSuccess(t('graph.edit_saved', '已保存（手工修正，重抽不会覆盖）'))
      await refresh()
      const node = await mobileGetNode(runtime.drizzleDb, vaultId, selectedNode.id)
      setSelectedNode(node)
    } catch (e: any) {
      setStatus(e?.message || String(e))
      toast.showError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const deleteSelected = () => {
    if (!selectedNode) return
    Alert.alert(
      t('graph.delete_node', '删除节点'),
      t('graph.confirm_delete_node', '确定删除该节点？相关边也会一并软删。'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.delete', '删除'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!services) return
              const runtime = getAgentDbRuntime()
              if (!runtime?.drizzleDb) return
              setBusy(true)
              try {
                await mobileSoftDeleteGraph({
                  drizzleDb: runtime.drizzleDb,
                  pathService: services.pathService,
                  fileSystem: services.fileSystem,
                  kind: 'node',
                  id: selectedNode.id
                })
                setSelectedNode(null)
                setSelectedId(null)
                setLocalView(null)
                setPinNeighborhood(false)
                await refresh()
                toast.showSuccess(t('graph.node_deleted', '已删除节点'))
              } catch (e: any) {
                setStatus(e?.message || String(e))
              } finally {
                setBusy(false)
              }
            })()
          }
        }
      ]
    )
  }

  const deleteEdge = (edgeId: string) => {
    Alert.alert(
      t('graph.delete_edge', '删除'),
      t('graph.confirm_delete_edge', '确定删除这条关系？'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.delete', '删除'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!services) return
              const runtime = getAgentDbRuntime()
              if (!runtime?.drizzleDb) return
              setBusy(true)
              try {
                await mobileSoftDeleteGraph({
                  drizzleDb: runtime.drizzleDb,
                  pathService: services.pathService,
                  fileSystem: services.fileSystem,
                  kind: 'edge',
                  id: edgeId
                })
                setLocalView((prev) =>
                  prev
                    ? { ...prev, edges: (prev.edges || []).filter((e: any) => e.id !== edgeId) }
                    : prev
                )
                await refresh()
                if (selectedId) {
                  const view = await mobileGetView(runtime.drizzleDb, vaultId, {
                    centerNodeId: selectedId,
                    depth: viewDepthFor(focusDepth)
                  })
                  setLocalView(view)
                }
                toast.showSuccess(t('graph.edge_deleted', '已删除关系'))
              } catch (e: any) {
                setStatus(e?.message || String(e))
                toast.showError(e?.message || String(e))
              } finally {
                setBusy(false)
              }
            })()
          }
        }
      ]
    )
  }

  const searchAddEdgeTarget = async () => {
    const runtime = getAgentDbRuntime()
    const q = addEdgeQuery.trim()
    if (!runtime?.drizzleDb || !q || !selectedNode) {
      setAddEdgeHits([])
      return
    }
    const found = await mobileSearchGraphNodes(runtime.drizzleDb, vaultId, q)
    setAddEdgeHits((found || []).filter((h: any) => h.id !== selectedNode.id))
  }

  const addEdge = async () => {
    if (!services || !selectedNode || !addEdgeToId) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    setBusy(true)
    try {
      await mobileUpsertEdge({
        drizzleDb: runtime.drizzleDb,
        pathService: services.pathService,
        fileSystem: services.fileSystem,
        vaultId,
        vaultDisplayName: vaultName,
        fromId: selectedNode.id,
        toId: addEdgeToId,
        edgeType: addEdgeType
      })
      setAddEdgeToId('')
      setAddEdgeQuery('')
      setAddEdgeHits([])
      setStatus(t('graph.edge_added', '已添加关系'))
      await refresh()
      if (selectedId) {
        const view = await mobileGetView(runtime.drizzleDb, vaultId, {
          centerNodeId: selectedId,
          depth: viewDepthFor(focusDepth)
        })
        setLocalView(view)
      }
    } catch (e: any) {
      setStatus(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const listPad = {
    padding: 16,
    paddingBottom: 16 + insets.bottom
  }

  const formatTokens = (n: number) => {
    if (n >= 10000) return t('graph.tokens_wan', '约 {{n}} 万', { n: (n / 10000).toFixed(1) })
    return t('graph.tokens_count', '约 {{n}}', { n })
  }

  const openSource = async (
    dateOrRef: string | null | undefined,
    fallbackExcerpt?: string | null
  ) => {
    const raw = String(dateOrRef || '').trim()
    const dateMatch = raw.match(/(\d{4}-\d{2}-\d{2})/)
    const date = dateMatch?.[1] ?? (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null)
    const excerpt = String(fallbackExcerpt || '').trim()
    if (!date && !excerpt) return

    setSourcePreview({ date, content: '', loading: Boolean(date) })
    if (!date) {
      setSourcePreview({ date: null, content: excerpt, loading: false })
      return
    }
    if (!services?.diaryService) {
      setSourcePreview({
        date,
        content: excerpt || t('graph.source_load_failed', '加载原文失败'),
        loading: false
      })
      return
    }
    try {
      const entry = await services.diaryService.findByDate(parseDateStr(date))
      const content = String(entry?.content || '').trim() || excerpt
      setSourcePreview({
        date,
        content: content || t('graph.source_not_found', '未找到该日日记原文'),
        loading: false
      })
    } catch (e: any) {
      setSourcePreview({
        date,
        content: excerpt || String(e?.message || e) || t('graph.source_load_failed', '加载原文失败'),
        loading: false
      })
    }
  }

  const phaseKey = awakenPending ? 'boot' : showAwakenGate ? 'awaken' : 'main'

  const renderDepthChips = () => (
    <View style={styles.depthRow}>
      <Text style={[styles.depthLabel, { color: colors.textSecondary }]}>
        {t('graph.focus_depth', '展开')}
      </Text>
      {GRAPH_FOCUS_DEPTH_OPTIONS.map((d) => {
        const active = focusDepth === d
        return (
          <Pressable
            key={d}
            onPress={() => updateFocusDepth(d)}
            style={[
              styles.depthChip,
              {
                backgroundColor: active ? colors.primary : colors.bgSurfaceNormal,
                borderColor: active ? colors.primary : colors.borderSubtle
              }
            ]}
          >
            <Text
              style={{
                color: active ? '#fff' : colors.textSecondary,
                fontSize: 12,
                fontWeight: active ? '700' : '500'
              }}
            >
              {d}
              {t('graph.focus_depth_unit', '级')}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )

  const renderForceSliders = () => (
    <>
      {(
        [
          ['centerStrength', 'graph.force_center', '向心力'],
          ['linkStrength', 'graph.force_link', '引力'],
          ['chargeStrength', 'graph.force_charge', '斥力'],
          ['linkDistance', 'graph.force_link_distance', '连线长度']
        ] as const
      ).map(([key, i18nKey, fallback]) => {
        const range = GRAPH_FORCE_RANGES[key]
        const value = forceSettings[key]
        return (
          <View key={key} style={styles.forceRow}>
            <Text style={[styles.forceLabel, { color: colors.textSecondary }]}>
              {t(i18nKey, fallback)}
            </Text>
            <View style={{ flex: 1 }}>
              <NativeSlider
                value={value}
                minValue={range.min}
                maxValue={range.max}
                step={range.step}
                onChange={(v) => updateForce({ [key]: v })}
              />
            </View>
            <Text style={[styles.forceValue, { color: colors.textSecondary }]}>
              {key === 'chargeStrength' ? Math.abs(value) : key === 'linkDistance' ? value : value.toFixed(2)}
            </Text>
          </View>
        )
      })}
      <View style={styles.row}>
        <Pressable onPress={() => setAnimationTick((n) => n + 1)}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
            {t('graph.relayout', '重新布局')}
          </Text>
        </Pressable>
        <Pressable onPress={resetGraphSettings}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
            {t('graph.force_reset', '恢复默认')}
          </Text>
        </Pressable>
      </View>
    </>
  )

  return (
    <StackScreenLayout
      title={t('graph.title', '关系图谱')}
      {...chrome}
      headerRight={
        phaseKey !== 'main'
          ? undefined
          : extractRunning
            ? {
                label: t('graph.stop_extract', '停止'),
                onPress: () => stopExtract()
              }
            : showEmptyGuide && tab === 'graph'
              ? undefined
              : {
                  label: t('graph.extract', '梳理'),
                  onPress: () => void runExtract(),
                  disabled: busy
                }
      }
      contentStyle={styles.layoutContent}
    >
      <GraphPhaseFade phaseKey={phaseKey}>
        {phaseKey === 'boot' ? (
          <View style={[styles.bootShell, { backgroundColor: colors.bgApp }]} />
        ) : phaseKey === 'awaken' ? (
          <GraphAwakenWelcome
            initialProfile={awakenProfile}
            busy={awakenBusy}
            onSubmit={completeAwaken}
          />
        ) : (
          <>
            <View style={[styles.tabTrack, { backgroundColor: colors.bgSurfaceNormal }]}>
              {tabItems.map(([id, label]) => {
                const active = tab === id
                return (
                  <Pressable
                    key={id}
                    style={[
                      styles.tab,
                      active && {
                        backgroundColor: colors.bgSurface,
                        borderColor: colors.borderMuted
                      }
                    ]}
                    onPress={() => setTab(id)}
                  >
                    <Text
                      style={{
                        color: active ? colors.primary : colors.textSecondary,
                        fontSize: 12,
                        fontWeight: active ? '600' : '500'
                      }}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {status ? (
              <Text style={[styles.status, { color: colors.textSecondary }]}>{status}</Text>
            ) : null}
            {busy || extractRunning ? (
              <ActivityIndicator color={colors.primary} style={{ marginBottom: 8 }} />
            ) : null}

            {tab === 'graph' && (
              <View style={[styles.graphBody, { paddingBottom: insets.bottom }]}>
                {!showEmptyGuide ? (
                  <>
                    <View style={styles.toolbarRow}>
                      <Pressable
                        onPress={() => setFilterOpen(true)}
                        style={[
                          styles.toolBtn,
                          {
                            borderColor: filterActive ? colors.primary : colors.borderSubtle,
                            backgroundColor: colors.bgSurfaceNormal
                          }
                        ]}
                      >
                        <Text
                          style={{
                            color: filterActive ? colors.primary : colors.textSecondary,
                            fontSize: 12,
                            fontWeight: '600'
                          }}
                        >
                          {t('graph.filter', '筛选')}
                        </Text>
                      </Pressable>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <GraphMonthRangeSheet value={monthRange} onChange={updateMonthRange} />
                      </View>
                      <Pressable
                        onPress={clearToGlobal}
                        style={[
                          styles.toolBtn,
                          {
                            borderColor: colors.borderSubtle,
                            backgroundColor: colors.bgSurfaceNormal
                          }
                        ]}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                          {t('graph.global_view', '全局')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setSettingsOpen(true)}
                        style={[
                          styles.toolBtn,
                          {
                            borderColor: colors.borderSubtle,
                            backgroundColor: colors.bgSurfaceNormal
                          }
                        ]}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                          {t('graph.settings', '设置')}
                        </Text>
                      </Pressable>
                    </View>
                    {renderDepthChips()}
                  </>
                ) : null}

                {selectedNode ? (
                  <ScrollView
                    style={[
                      styles.detailPanel,
                      {
                        backgroundColor: colors.bgSurface,
                        borderBottomColor: colors.borderSubtle
                      }
                    ]}
                    contentContainerStyle={styles.detailPanelContent}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    <TextInput
                      value={editName}
                      onChangeText={setEditName}
                      placeholder={t('graph.edit_name', '名称')}
                      placeholderTextColor={colors.textSecondary}
                      style={[
                        styles.renameInput,
                        { color: colors.textPrimary, borderColor: colors.borderSubtle }
                      ]}
                    />
                    <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
                      {translateGraphNodeType(tr, selectedNode.nodeType)}
                      {selectedNode.reviewStatus === 'pending'
                        ? ` · ${t('graph.pending_badge', '待确认')}`
                        : ''}
                    </Text>
                    <TextInput
                      value={editSummary}
                      onChangeText={setEditSummary}
                      placeholder={t('graph.edit_summary', '摘要')}
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      style={[
                        styles.renameInput,
                        styles.multilineInput,
                        { color: colors.textPrimary, borderColor: colors.borderSubtle }
                      ]}
                    />
                    <TextInput
                      value={editAliases}
                      onChangeText={setEditAliases}
                      placeholder={t('graph.edit_aliases', '别名（逗号分隔）')}
                      placeholderTextColor={colors.textSecondary}
                      style={[
                        styles.renameInput,
                        { color: colors.textPrimary, borderColor: colors.borderSubtle }
                      ]}
                    />
                    <View style={styles.row}>
                      <Pressable disabled={busy} onPress={() => void saveNodeEdit()}>
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>
                          {t('graph.save_edit', '保存修改')}
                        </Text>
                      </Pressable>
                      {selectedNode.reviewStatus === 'pending' ? (
                        <>
                          <Pressable onPress={() => void reviewNode(selectedNode.id, 'approved')}>
                            <Text style={{ color: colors.primary, fontWeight: '600' }}>
                              {t('graph.approve', '通过')}
                            </Text>
                          </Pressable>
                          <Pressable onPress={() => void reviewNode(selectedNode.id, 'rejected')}>
                            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                              {t('graph.reject', '拒绝')}
                            </Text>
                          </Pressable>
                        </>
                      ) : null}
                      <Pressable onPress={deleteSelected}>
                        <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                          {t('graph.delete_node', '删除')}
                        </Text>
                      </Pressable>
                    </View>

                    {detailEdges.length > 0 ? (
                      <View style={styles.incidentBlock}>
                        <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
                          {t('graph.incident_edges', '相关关系')}
                        </Text>
                        {detailEdges.map(({ edge, partnerName }) => (
                          <View
                            key={edge.id}
                            style={[
                              styles.incidentRow,
                              { borderColor: colors.borderSubtle }
                            ]}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}
                                numberOfLines={1}
                              >
                                {translateGraphEdgeType(tr, edge.edgeType)} · {partnerName}
                              </Text>
                              {edge.reviewStatus === 'pending' ? (
                                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                                  {t('graph.pending_badge', '待确认')}
                                </Text>
                              ) : null}
                            </View>
                            {edge.sourceRef || edge.sourceExcerpt ? (
                              <Pressable
                                onPress={() =>
                                  void openSource(edge.sourceRef, edge.sourceExcerpt)
                                }
                                hitSlop={6}
                              >
                                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                                  {t('graph.open_source', '原文')}
                                </Text>
                              </Pressable>
                            ) : null}
                            {edge.reviewStatus === 'pending' ? (
                              <>
                                <Pressable
                                  onPress={() =>
                                    void reviewEdge(edge.id, 'approved', {
                                      fromId: edge.fromId,
                                      toId: edge.toId
                                    })
                                  }
                                >
                                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                                    {t('graph.approve', '通过')}
                                  </Text>
                                </Pressable>
                                <Pressable onPress={() => void reviewEdge(edge.id, 'rejected')}>
                                  <Text
                                    style={{
                                      color: colors.textSecondary,
                                      fontSize: 12,
                                      fontWeight: '600'
                                    }}
                                  >
                                    {t('graph.reject', '拒绝')}
                                  </Text>
                                </Pressable>
                              </>
                            ) : null}
                            <Pressable onPress={() => deleteEdge(edge.id)}>
                              <Text
                                style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}
                              >
                                {t('graph.delete_edge', '删除')}
                              </Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <Text style={[styles.detailMeta, { color: colors.textSecondary, marginTop: 4 }]}>
                      {t('graph.add_edge', '添加关系')}
                    </Text>
                    <View style={styles.addEdgeSearchRow}>
                      <TextInput
                        value={addEdgeQuery}
                        onChangeText={setAddEdgeQuery}
                        placeholder={t('graph.add_edge_search', '搜索目标节点')}
                        placeholderTextColor={colors.textSecondary}
                        style={[
                          styles.renameInput,
                          { flex: 1, color: colors.textPrimary, borderColor: colors.borderSubtle }
                        ]}
                        returnKeyType="search"
                        onSubmitEditing={() => void searchAddEdgeTarget()}
                      />
                      <Pressable onPress={() => void searchAddEdgeTarget()} hitSlop={8}>
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>
                          {t('graph.search', '搜索')}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.edgeTypeRow}>
                      {GRAPH_EDGE_TYPES.map((et) => {
                        const active = addEdgeType === et
                        return (
                          <Pressable
                            key={et}
                            onPress={() => setAddEdgeType(et)}
                            style={[
                              styles.edgeTypeChip,
                              {
                                backgroundColor: active ? colors.primary : colors.bgSurfaceNormal,
                                borderColor: active ? colors.primary : colors.borderSubtle
                              }
                            ]}
                          >
                            <Text
                              style={{
                                color: active ? '#fff' : colors.textSecondary,
                                fontSize: 11,
                                fontWeight: active ? '700' : '500'
                              }}
                            >
                              {translateGraphEdgeType(tr, et)}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                    <Pressable
                      disabled={busy || !addEdgeToId}
                      onPress={() => void addEdge()}
                      style={{ opacity: busy || !addEdgeToId ? 0.4 : 1 }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '700' }}>
                        {t('graph.add_edge_submit', '添加')}
                      </Text>
                    </Pressable>
                    {addEdgeHits.map((h) => {
                      const active = addEdgeToId === h.id
                      return (
                        <Pressable
                          key={h.id}
                          onPress={() => setAddEdgeToId(h.id)}
                          style={[
                            styles.hitBtn,
                            {
                              backgroundColor: active ? colors.bgSurfaceNormal : 'transparent',
                              borderColor: active ? colors.primary : colors.borderSubtle
                            }
                          ]}
                        >
                          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                            {h.name}
                          </Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                            {translateGraphNodeType(tr, h.nodeType)}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </ScrollView>
                ) : null}

                {showEmptyGuide ? (
                  <View style={styles.guide}>
                    <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
                      {t('graph.empty_guide_title', '还没有开始整理你的关系图谱')}
                    </Text>
                    <Text style={[styles.guideBody, { color: colors.textSecondary }]}>
                      {t(
                        'graph.empty_guide_body',
                        '发现 {{count}} 篇日记可以分析，预计消耗 {{tokens}} tokens（约 {{usdLow}}–{{usdHigh}} USD），用时约 {{minLow}}–{{minHigh}} 分钟。',
                        {
                          count: estimate?.entryCount ?? pending.length,
                          tokens: formatTokens(estimate?.estimatedTokens ?? 0),
                          usdLow: (estimate?.estimatedUsdLow ?? 0).toFixed(2),
                          usdHigh: (estimate?.estimatedUsdHigh ?? 0).toFixed(2),
                          minLow: estimate?.estimatedMinutesLow ?? 1,
                          minHigh: estimate?.estimatedMinutesHigh ?? 1
                        }
                      )}
                    </Text>
                    <View style={styles.row}>
                      <Pressable disabled={extractRunning} onPress={() => void runExtract()}>
                        <Text style={{ color: colors.primary, fontWeight: '700' }}>
                          {t('graph.start_organize', '开始整理')}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => setDismissGuide(true)}>
                        <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                          {t('graph.later', '以后再说')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : showMonthEmpty ? (
                  <View style={styles.guide}>
                    <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
                      {t('graph.month_empty_title', '这个月份范围内还没有关系')}
                    </Text>
                    <Text style={[styles.guideBody, { color: colors.textSecondary }]}>
                      {t(
                        'graph.month_empty_body',
                        '当前显示 {{start}} — {{end}}。可扩大月份范围，或先梳理日记。',
                        {
                          start: monthRange.startMonth,
                          end: monthRange.endMonth
                        }
                      )}
                    </Text>
                    <View style={styles.row}>
                      <Pressable onPress={resetMonthRange}>
                        <Text style={{ color: colors.primary, fontWeight: '700' }}>
                          {t('graph.month_range_recent3', '近3月')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          const start = parseGraphMonthToDate(monthRange.startMonth)
                          start.setMonth(start.getMonth() - 12)
                          updateMonthRange({
                            startMonth: formatGraphMonth(start),
                            endMonth: monthRange.endMonth
                          })
                        }}
                      >
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>
                          {t('graph.month_range_earlier', '再往前一年')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.webWrap, { backgroundColor: colors.bgApp }]}>
                    <GraphForceWebView
                      nodes={displayNodes.map((n) => ({
                        id: n.id,
                        name: n.name,
                        nodeType: n.nodeType,
                        mentionCount: n.mentionCount,
                        reviewStatus: n.reviewStatus
                      }))}
                      edges={displayEdges.map((e) => ({
                        id: e.id,
                        fromId: e.fromId,
                        toId: e.toId,
                        edgeType: e.edgeType,
                        reviewStatus: e.reviewStatus
                      }))}
                      forceSettings={forceSettings}
                      appearanceSettings={appearanceSettings}
                      selectedId={selectedId}
                      focusIds={focusIds}
                      highlightIds={highlightIds}
                      locateSeq={locateSeq}
                      animationTick={animationTick}
                      onSelectNode={(n) => void onSelectNode(n.id)}
                      onClearSelection={clearSelectionKeepPin}
                    />
                  </View>
                )}
              </View>
            )}

            {tab === 'search' && (
              <>
                <View style={styles.searchRow}>
                  <Input
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t('graph.search_placeholder', '搜索实体')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={() => void onSearch()}
                    containerStyle={{ flex: 1 }}
                  />
                  <Pressable onPress={() => void onSearch()} hitSlop={8}>
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>
                      {t('common.search', '搜索')}
                    </Text>
                  </Pressable>
                </View>
                <FlatList
                  data={hits}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={listPad}
                  ListEmptyComponent={
                    <Text style={{ color: colors.textSecondary }}>
                      {t('graph.search_empty', '输入关键词搜索图谱实体')}
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => void onSearchHitPress(item)}
                      style={[
                        styles.card,
                        {
                          backgroundColor: colors.bgSurface,
                          borderColor: colors.borderSubtle
                        }
                      ]}
                    >
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                        {translateGraphNodeType(tr, item.nodeType)}
                        {item.summary ? ` · ${item.summary}` : ''}
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            )}

            {tab === 'reextract' && (
              <FlatList
                data={pending}
                keyExtractor={(item) => item.filePath}
                contentContainerStyle={listPad}
                ListEmptyComponent={
                  <Text style={{ color: colors.textSecondary }}>
                    {t('graph.reextract_empty', '暂无待重抽日记')}
                  </Text>
                }
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.bgSurface,
                        borderColor: colors.borderSubtle
                      }
                    ]}
                  >
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                      {item.date || item.filePath}
                    </Text>
                    <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                      {item.filePath}
                    </Text>
                    <View style={styles.row}>
                      <Pressable
                        disabled={extractRunning}
                        onPress={() => void runExtract([item.filePath])}
                      >
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>
                          {t('graph.extract_one', '抽取')}
                        </Text>
                      </Pressable>
                      {item.date ? (
                        <Pressable onPress={() => void openSource(item.date)}>
                          <Text style={{ color: colors.primary, fontWeight: '600' }}>
                            {t('graph.open_source', '原文')}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                )}
              />
            )}

            {tab === 'pending' && (
              <FlatList
                data={pendingItems}
                keyExtractor={(item) => `${item.kind}-${item.id}`}
                contentContainerStyle={listPad}
                ListEmptyComponent={
                  <Text style={{ color: colors.textSecondary }}>
                    {t('graph.no_pending', '没有待确认的节点或边')}
                  </Text>
                }
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.bgSurface,
                        borderColor: colors.borderSubtle
                      }
                    ]}
                  >
                    {item.kind === 'node' ? (
                      <>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                          {t('graph.pending_node', '节点')} · {item.data.name}
                        </Text>
                        <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                          {translateGraphNodeType(tr, item.data.nodeType)}
                          {item.data.summary ? ` · ${item.data.summary}` : ''}
                        </Text>
                        <View style={styles.row}>
                          <Pressable onPress={() => void reviewNode(item.id, 'approved')}>
                            <Text style={{ color: colors.primary, fontWeight: '600' }}>
                              {t('graph.approve', '通过')}
                            </Text>
                          </Pressable>
                          <Pressable onPress={() => void reviewNode(item.id, 'rejected')}>
                            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                              {t('graph.reject', '拒绝')}
                            </Text>
                          </Pressable>
                          <Pressable onPress={() => locatePendingNode(item.id)}>
                            <Text style={{ color: colors.primary, fontWeight: '600' }}>
                              {t('graph.locate', '查看')}
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                          {t('graph.pending_edge', '关系')} ·{' '}
                          {translateGraphEdgeType(tr, item.data.edgeType)} · {item.data.confidence}
                        </Text>
                        <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                          {item.data.sourceExcerpt || item.data.sourceRef || item.data.id}
                        </Text>
                        <View style={styles.row}>
                          <Pressable
                            onPress={() =>
                              void reviewEdge(item.id, 'approved', {
                                fromId: item.data.fromId,
                                toId: item.data.toId
                              })
                            }
                          >
                            <Text style={{ color: colors.primary, fontWeight: '600' }}>
                              {t('graph.approve', '通过')}
                            </Text>
                          </Pressable>
                          <Pressable onPress={() => void reviewEdge(item.id, 'rejected')}>
                            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                              {t('graph.reject', '拒绝')}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              void locatePendingEdge({
                                fromId: item.data.fromId,
                                toId: item.data.toId
                              })
                            }
                          >
                            <Text style={{ color: colors.primary, fontWeight: '600' }}>
                              {t('graph.locate', '查看')}
                            </Text>
                          </Pressable>
                          {item.data.sourceRef ? (
                            <Pressable
                              onPress={() =>
                                void openSource(item.data.sourceRef, item.data.sourceExcerpt)
                              }
                            >
                              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                                {t('graph.open_source', '原文')}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </>
                    )}
                  </View>
                )}
              />
            )}
          </>
        )}
      </GraphPhaseFade>

      <FloatingModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        maxWidth={Math.min(screenWidth - 32, 420)}
      >
        <ScrollView contentContainerStyle={styles.modalPad} keyboardShouldPersistTaps="handled">
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {t('graph.filter', '筛选')}
          </Text>
          <View style={styles.switchRow}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
              {t('graph.hide_entry_anchors', '隐藏日记锚点')}
            </Text>
            <Switch value={hideEntry} onValueChange={setHideEntry} />
          </View>
          <View style={styles.switchRow}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
              {t('graph.approved_only', '只看已确认')}
            </Text>
            <Switch value={approvedOnly} onValueChange={setApprovedOnly} />
          </View>
          <View style={styles.filterSectionHead}>
            <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
              {t('graph.filter_by_type', '按分类')}
            </Text>
            <Pressable
              onPress={() =>
                setEnabledNodeTypes(
                  typeFilterActive ? new Set(GRAPH_FILTER_NODE_TYPES) : new Set()
                )
              }
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                {typeFilterActive
                  ? t('graph.filter_select_all_types', '全选')
                  : t('graph.filter_clear_types', '清空')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.typeChipRow}>
            {GRAPH_FILTER_NODE_TYPES.map((nodeType) => {
              const active = enabledNodeTypes.has(nodeType)
              return (
                <Pressable
                  key={nodeType}
                  onPress={() => toggleNodeTypeFilter(nodeType)}
                  style={[
                    styles.edgeTypeChip,
                    {
                      backgroundColor: active ? colors.primary : colors.bgSurfaceNormal,
                      borderColor: active ? colors.primary : colors.borderSubtle
                    }
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#fff' : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: active ? '700' : '500'
                    }}
                  >
                    {t(
                      `graph.node_type.${nodeType}`,
                      GRAPH_NODE_TYPE_LABEL_FALLBACKS[nodeType] ?? nodeType
                    )}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <Pressable
            onPress={() => setFilterOpen(false)}
            style={{ alignSelf: 'flex-end', marginTop: 12 }}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {t('common.done', '完成')}
            </Text>
          </Pressable>
        </ScrollView>
      </FloatingModal>

      <FloatingModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth={Math.min(screenWidth - 32, 440)}
      >
        <ScrollView
          style={{ maxHeight: 560 }}
          contentContainerStyle={styles.modalPad}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {t('graph.settings', '设置')}
          </Text>

          <Pressable
            onPress={() => setSettingsSection((s) => ({ ...s, profile: !s.profile }))}
            style={styles.settingsHead}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {settingsSection.profile ? '▾ ' : '▸ '}
              {t('graph.profile_section', '身份资料')}
            </Text>
          </Pressable>
          {settingsSection.profile ? (
            <View style={styles.settingsBody}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
                {t(
                  'graph.profile_hint',
                  '用于识别日记中的「我」。修改昵称会同步更新图谱中的自称节点，旧昵称保留为别名，无需重建整图。'
                )}
              </Text>
              <TextInput
                value={profileForm.nickname}
                onChangeText={(v) => setProfileForm((p) => ({ ...p, nickname: v }))}
                placeholder={t('graph.awaken_nickname_label', '昵称')}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.renameInput,
                  {
                    color: colors.textPrimary,
                    borderColor: profileErrors.nickname ? colors.error : colors.borderSubtle
                  }
                ]}
              />
              <TextInput
                value={profileForm.birthday}
                onChangeText={(v) => setProfileForm((p) => ({ ...p, birthday: v }))}
                placeholder={t('graph.awaken_birthday_label', '生日 YYYY-MM-DD')}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.renameInput,
                  {
                    color: colors.textPrimary,
                    borderColor: profileErrors.birthday ? colors.error : colors.borderSubtle
                  }
                ]}
              />
              <View style={styles.typeChipRow}>
                {USER_GENDER_OPTIONS.map((g) => {
                  const active = profileForm.gender === g
                  return (
                    <Pressable
                      key={g}
                      onPress={() => setProfileForm((p) => ({ ...p, gender: g }))}
                      style={[
                        styles.edgeTypeChip,
                        {
                          backgroundColor: active ? colors.primary : colors.bgSurfaceNormal,
                          borderColor: active
                            ? colors.primary
                            : profileErrors.gender
                              ? colors.error
                              : colors.borderSubtle
                        }
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? '#fff' : colors.textSecondary,
                          fontSize: 12,
                          fontWeight: active ? '700' : '500'
                        }}
                      >
                        {t(`graph.awaken_gender_${g}`, g)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              <Pressable disabled={profileBusy} onPress={() => void saveProfileFromSettings()}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {t('graph.profile_save', '保存身份资料')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            onPress={() => setSettingsSection((s) => ({ ...s, view: !s.view }))}
            style={styles.settingsHead}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {settingsSection.view ? '▾ ' : '▸ '}
              {t('graph.view_section', '浏览')}
            </Text>
          </Pressable>
          {settingsSection.view ? (
            <View style={styles.settingsBody}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {t('graph.month_range', '月份范围')}
              </Text>
              <GraphMonthRangeSheet block value={monthRange} onChange={updateMonthRange} />
              {renderDepthChips()}
            </View>
          ) : null}

          <Pressable
            onPress={() => setSettingsSection((s) => ({ ...s, appearance: !s.appearance }))}
            style={styles.settingsHead}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {settingsSection.appearance ? '▾ ' : '▸ '}
              {t('graph.appearance', '外观')}
            </Text>
          </Pressable>
          {settingsSection.appearance ? (
            <View style={styles.settingsBody}>
              <View style={styles.switchRow}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
                  {t('graph.show_arrows', '箭头')}
                </Text>
                <Switch
                  value={appearanceSettings.showArrows}
                  onValueChange={(v) => updateAppearance({ showArrows: v })}
                />
              </View>
              {(
                [
                  ['textOpacity', 'graph.text_opacity', '文本透明度'],
                  ['nodeSize', 'graph.node_size', '节点大小'],
                  ['lineThickness', 'graph.line_thickness', '连线粗细'],
                  ['hubLabelMinDegree', 'graph.hub_label_min_degree', '枢纽度数'],
                  ['hubLabelMinMentions', 'graph.hub_label_min_mentions', '枢纽提及']
                ] as const
              ).map(([key, i18nKey, fallback]) => {
                const range = GRAPH_APPEARANCE_RANGES[key]
                const value = appearanceSettings[key]
                return (
                  <View key={key} style={styles.forceRow}>
                    <Text style={[styles.forceLabelWide, { color: colors.textSecondary }]}>
                      {t(i18nKey, fallback)}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <NativeSlider
                        value={value}
                        minValue={range.min}
                        maxValue={range.max}
                        step={range.step}
                        onChange={(v) => updateAppearance({ [key]: v })}
                      />
                    </View>
                    <Text style={[styles.forceValue, { color: colors.textSecondary }]}>
                      {typeof value === 'number' && !Number.isInteger(range.step)
                        ? value.toFixed(2)
                        : value}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : null}

          <Pressable
            onPress={() => setSettingsSection((s) => ({ ...s, forces: !s.forces }))}
            style={styles.settingsHead}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {settingsSection.forces ? '▾ ' : '▸ '}
              {t('graph.force_layout', '布局力')}
            </Text>
          </Pressable>
          {settingsSection.forces ? (
            <View style={styles.settingsBody}>{renderForceSliders()}</View>
          ) : null}

          <Pressable
            onPress={() => setSettingsOpen(false)}
            style={{ alignSelf: 'flex-end', marginTop: 8 }}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {t('common.close', '关闭')}
            </Text>
          </Pressable>
        </ScrollView>
      </FloatingModal>

      <FloatingModal
        visible={Boolean(sourcePreview)}
        onClose={() => setSourcePreview(null)}
        maxWidth={Math.min(screenWidth - 32, 520)}
      >
        <View style={styles.sourceHeader}>
          <Text style={[styles.sourceTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {sourcePreview?.date
              ? t('graph.source_preview_title', '{{date}} 原文', { date: sourcePreview.date })
              : t('graph.source_preview_title_generic', '原文')}
          </Text>
          <Pressable onPress={() => setSourcePreview(null)} hitSlop={8}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
              {t('common.close', '关闭')}
            </Text>
          </Pressable>
        </View>
        {sourcePreview?.loading ? (
          <View style={styles.sourceLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.sourceScroll}
            contentContainerStyle={styles.sourceScrollContent}
            showsVerticalScrollIndicator
          >
            <MarkdownRenderer content={sourcePreview?.content || ''} variant="preview" />
          </ScrollView>
        )}
      </FloatingModal>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: {
    flex: 1,
    position: 'relative'
  },
  bootShell: {
    flex: 1
  },
  tabTrack: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    padding: 4,
    borderRadius: 12
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent'
  },
  status: {
    paddingHorizontal: 16,
    marginBottom: 8,
    fontSize: 13
  },
  graphBody: {
    flex: 1
  },
  webWrap: {
    flex: 1
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth
  },
  depthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 6
  },
  depthLabel: {
    fontSize: 12,
    marginRight: 2
  },
  depthChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  forceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  forceLabel: {
    width: 44,
    fontSize: 12
  },
  forceLabelWide: {
    width: 72,
    fontSize: 11
  },
  forceValue: {
    width: 36,
    fontSize: 11,
    textAlign: 'right'
  },
  detailPanel: {
    maxHeight: 280,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  detailPanelContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6
  },
  renameInput: {
    fontSize: 14,
    fontWeight: '600',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  multilineInput: {
    minHeight: 56,
    fontWeight: '400',
    textAlignVertical: 'top'
  },
  detailMeta: {
    fontSize: 12
  },
  incidentBlock: {
    gap: 6,
    marginTop: 4
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8
  },
  guide: {
    padding: 24,
    gap: 12
  },
  guideTitle: {
    fontSize: 17,
    fontWeight: '700'
  },
  guideBody: {
    fontSize: 14,
    lineHeight: 22
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  card: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    flexWrap: 'wrap'
  },
  addEdgeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  edgeTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  edgeTypeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  hitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2
  },
  modalPad: {
    padding: 16,
    gap: 10
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4
  },
  filterSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4
  },
  typeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  settingsHead: {
    paddingVertical: 8
  },
  settingsBody: {
    gap: 8,
    paddingBottom: 8
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10
  },
  sourceTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700'
  },
  sourceLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sourceScroll: {
    maxHeight: 420
  },
  sourceScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20
  }
})
