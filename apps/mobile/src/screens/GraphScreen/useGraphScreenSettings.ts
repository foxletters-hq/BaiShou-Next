import { useCallback, useEffect, useState } from 'react'
import {
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_APPEARANCE_STORAGE_KEY,
  GRAPH_FORCE_DEFAULTS,
  GRAPH_FORCE_STORAGE_KEY,
  GRAPH_MONTH_RANGE_STORAGE_KEY,
  clampGraphAppearanceSettings,
  clampGraphForceSettings,
  clampGraphMonthRange,
  defaultGraphMonthRange,
  loadGraphForceSettings,
  saveGraphAppearanceSettings,
  saveGraphForceSettings,
  type GraphAppearanceSettings,
  type GraphFocusDepth,
  type GraphForceSettings,
  type GraphMonthRange,
  type UserGender,
  type UserProfile,
  validateGraphAwakenForm
} from '@baishou/shared'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import { mobileGetNode, mobileGetView } from '@/src/services/mobile-graph.service'
import {
  loadMobileGraphAwakenSelfName,
  saveMobileGraphAwakenProfile
} from '../DiaryScreen/ensure-graph-self-name'
import {
  GRAPH_FILTER_NODE_TYPES,
  isGraphCanvasFilterActive,
  isGraphTypeFilterActive,
  toggleGraphNodeTypeFilter
} from './graph-screen-display.util'
import {
  buildGraphSelfPersonAliases,
  findGraphSelfPersonHit,
  graphProfileFormFromAwaken
} from './graph-screen-derive.util'
import { viewDepthFor } from './graph-screen-view.util'
import type { GraphScreenSettingsSection, GraphScreenTranslateFn } from './graph-screen.types'
import { mobileSearchGraphNodes, mobileUpsertNode } from '@/src/services/mobile-graph.service'

type SettingsDeps = {
  t: GraphScreenTranslateFn
  toast: { showSuccess: (message: string) => void; showError: (message: string) => void }
  services: {
    settingsManager: unknown
    pathService: unknown
    fileSystem: unknown
  } | null
  dbReady: boolean
  vaultId: string
  vaultName: string
  setStatus: (status: string) => void
}

type SaveProfileContext = {
  selectedId: string | null
  selectedNode: any | null
  focusDepth: GraphFocusDepth
  setLocalView: (view: { nodes: any[]; edges: any[] } | null) => void
  setSelectedNode: (node: any | null) => void
  refresh: () => Promise<void>
}

export function useGraphScreenSettings(deps: SettingsDeps) {
  const [hideEntry, setHideEntry] = useState(true)
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<string>>(
    () => new Set(GRAPH_FILTER_NODE_TYPES)
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<GraphScreenSettingsSection>({
    organize: true,
    profile: false,
    data: false,
    canvas: true,
    appearance: true,
    forces: true
  })
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [forceSettings, setForceSettings] = useState<GraphForceSettings>(() =>
    loadGraphForceSettings()
  )
  const [appearanceSettings, setAppearanceSettings] = useState<GraphAppearanceSettings>(() =>
    clampGraphAppearanceSettings(GRAPH_APPEARANCE_DEFAULTS)
  )
  const [monthRange, setMonthRange] = useState<GraphMonthRange>(() => defaultGraphMonthRange())
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

  useEffect(() => {
    if (!deps.services || !deps.dbReady) return
    let cancelled = false
    void (async () => {
      try {
        const state = await loadMobileGraphAwakenSelfName(deps.services!.settingsManager as never)
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
  }, [deps.services, deps.dbReady])

  useEffect(() => {
    if (!awakenProfile) return
    setProfileForm(graphProfileFormFromAwaken(awakenProfile))
  }, [awakenProfile])

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
      saveGraphAppearanceSettings(next)
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
    saveGraphAppearanceSettings(appearance)
    void AsyncStorage.setItem(GRAPH_APPEARANCE_STORAGE_KEY, JSON.stringify(appearance))
  }, [])

  const persistMonthRange = (next: GraphMonthRange) => {
    setMonthRange(next)
    void AsyncStorage.setItem(GRAPH_MONTH_RANGE_STORAGE_KEY, JSON.stringify(next))
  }

  const toggleNodeTypeFilter = (nodeType: string) => {
    setEnabledNodeTypes((prev) => toggleGraphNodeTypeFilter(prev, nodeType))
  }

  const resetFilters = () => {
    setHideEntry(true)
    setApprovedOnly(false)
    setEnabledNodeTypes(new Set(GRAPH_FILTER_NODE_TYPES))
  }

  const typeFilterActive = isGraphTypeFilterActive(enabledNodeTypes)
  const filterActive = isGraphCanvasFilterActive({
    hideEntry,
    approvedOnly,
    enabledNodeTypes
  })

  const completeAwaken = async (fields: {
    nickname: string
    birthday: string
    gender: UserGender
  }) => {
    if (!deps.services) return
    setAwakenBusy(true)
    try {
      await saveMobileGraphAwakenProfile(deps.services.settingsManager as never, fields)
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
      deps.setStatus('')
    } catch (e: any) {
      deps.setStatus(String(e?.message || e))
      deps.toast.showError(String(e?.message || e))
    } finally {
      setAwakenBusy(false)
    }
  }

  const syncSelfPersonNode = async (oldName: string, newName: string) => {
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb || !deps.services) return false
    const prev = oldName.trim()
    const next = newName.trim()
    if (!prev || !next || prev === next) return false
    const hits = await mobileSearchGraphNodes(runtime.drizzleDb, deps.vaultId, prev)
    const match = findGraphSelfPersonHit(
      (hits || []).filter((h: any) => h.nodeType === 'person'),
      prev
    )
    if (!match) return false
    await mobileUpsertNode({
      drizzleDb: runtime.drizzleDb,
      pathService: deps.services.pathService as never,
      fileSystem: deps.services.fileSystem as never,
      vaultId: deps.vaultId,
      vaultDisplayName: deps.vaultName,
      id: match.id,
      name: next,
      nodeType: 'person',
      aliases: buildGraphSelfPersonAliases(match.aliases, prev, next),
      summary: match.summary || undefined
    })
    return true
  }

  const saveProfileFromSettings = async (ctx: SaveProfileContext) => {
    if (!deps.services) return
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
      await saveMobileGraphAwakenProfile(deps.services.settingsManager as never, fields)
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
      await ctx.refresh()
      if (ctx.selectedId) {
        const runtime = getAgentDbRuntime()
        if (runtime?.drizzleDb) {
          const view = await mobileGetView(runtime.drizzleDb, deps.vaultId, {
            centerNodeId: ctx.selectedId,
            depth: viewDepthFor(ctx.focusDepth)
          })
          ctx.setLocalView(view)
          if (ctx.selectedNode?.id === ctx.selectedId) {
            const node = await mobileGetNode(runtime.drizzleDb, deps.vaultId, ctx.selectedId)
            ctx.setSelectedNode(node)
          }
        }
      }
      deps.toast.showSuccess(
        synced
          ? deps.t('graph.profile_saved_synced', '已保存，并同步更新图谱中的自称节点')
          : deps.t('graph.profile_saved', '已保存身份资料')
      )
    } catch (e: any) {
      const message = e?.message || String(e)
      deps.setStatus(message)
      deps.toast.showError(message)
    } finally {
      setProfileBusy(false)
    }
  }

  return {
    hideEntry,
    setHideEntry,
    enabledNodeTypes,
    setEnabledNodeTypes,
    settingsOpen,
    setSettingsOpen,
    settingsSection,
    setSettingsSection,
    approvedOnly,
    setApprovedOnly,
    forceSettings,
    appearanceSettings,
    monthRange,
    persistMonthRange,
    selfNameReady,
    setSelfNameReady,
    awakenProfile,
    awakenBusy,
    profileForm,
    setProfileForm,
    profileBusy,
    profileErrors,
    updateForce,
    updateAppearance,
    resetGraphSettings,
    toggleNodeTypeFilter,
    resetFilters,
    typeFilterActive,
    filterActive,
    completeAwaken,
    saveProfileFromSettings
  }
}
