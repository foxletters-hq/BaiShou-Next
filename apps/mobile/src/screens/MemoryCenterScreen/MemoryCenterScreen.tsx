import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  buildMemoryOnboardingModel,
  buildMemoryReadinessRows,
  deriveLegacyVaultId,
  EMPTY_PENDING_EMBED_COUNTS,
  filterProvidersForModelSwitcher,
  formatReasoningEffortLabel,
  getUserProfileFromSettings,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  hasGraphModelConfigured,
  isDefaultGraphSelfName,
  isEmbeddingConfiguredForMemory,
  normalizeGraphAwakenNickname,
  resolveMemoryOrganizeAction,
  resolveMemoryOrganizeConfigurePrompt,
  resolveReasoningEffortForSlot,
  saveUserProfileToSettings,
  setReasoningEffortForSlot,
  shouldShowMemoryOnboarding,
  logger,
  waitForIdle,
  type AIProviderConfig,
  type GlobalModelsConfig,
  type MemoryCenterTab,
  type PendingEmbedCounts,
  type RagConfig,
  type ReasoningEffortSetting,
  type UserProfile
} from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Card,
  ModelSwitcher,
  modalActionsStyle,
  SegmentedContent,
  SegmentedControl,
  useDialog,
  useNativeTheme,
  useNativeToast
} from '@baishou/ui/native'
import { getDefaultGlobalModels } from '@baishou/store'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { RAGMemorySection } from '../SettingsScreen/components/RAGMemorySection'
import { mobileListPendingReextract } from '@/src/services/mobile-graph.service'
import { mobileGraphExtractQueue } from '@/src/services/mobile-graph-extract-queue.service'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  hydrateOrganizePendingSnapshot,
  peekOrganizePendingSnapshot,
  subscribeMobilePendingEmbedCountsChanged
} from '@/src/services/mobile-pending-embed-counts'
import {
  readMemoryOnboardingDismissed,
  writeMemoryOnboardingDismissed
} from './memory-center-onboarding.storage'
import {
  normalizeMemoryCenterRagConfig,
  readActiveVaultSafely,
  resolveMemoryCenterTabParam
} from './memory-center-data.util'
import { useMobileSuspectCount } from '@/src/hooks/useMobileSuspectCount'
import {
  immediateOrganizePendingSnapshot,
  isMemoryOrganizeCancelledError,
  isMemoryOrganizeIdle,
  loadMemoryOrganizePending,
  snapshotMemoryEmbedPhases
} from './memory-center-organize.util'
import { ensureMobileGraphSelfName } from '../DiaryScreen/ensure-graph-self-name'
import {
  getCachedMobileRagState,
  patchCachedMobileRagState
} from '@/src/services/mobile-rag-runtime-cache'
import { getBatchEmbedInFlight } from '@/src/services/mobile-rag-state.helpers'
import {
  readMemoryOrganizeInterrupted,
  writeMemoryOrganizeInterrupted
} from './memory-center-organize.storage'
import { MemoryOrganizeFabHost, MemoryOrganizeProgressHost } from './MemoryOrganizeChrome'
import {
  MemoryReadinessConfigModal,
  MemoryReadinessSettingsBody
} from './MemoryReadinessConfigModal'
import { GraphScreen } from '../GraphScreen/GraphScreen'
import {
  SettingsProfileModal,
  type SettingsProfileSavePayload
} from '../SettingsScreen/components/SettingsProfileModal'
import { notifyUserProfileRefresh } from '@/src/lib/user-profile-refresh-signal'
import { notifyAgentProfileRefresh } from '../SettingsScreen/components/settings-account-profile.util'

type MemoryOrganizeRefreshSnapshot = {
  embeddingConfigured: boolean
  extractConfigured: boolean
  pendingEmbedCount: number
  pendingGraphCount: number
  livePending: PendingEmbedCounts & { graphExtract?: number; graphDisambiguate?: number }
  providers: AIProviderConfig[]
}

export function MemoryCenterScreen() {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const toast = useNativeToast()
  const dialog = useDialog()
  const chrome = getStackScreenChrome(colors)
  const { dbReady, services } = useBaishou()
  const params = useLocalSearchParams<{ tab?: string | string[] }>()
  const tabParam = resolveMemoryCenterTabParam(params.tab)
  const [tab, setTab] = useState<MemoryCenterTab>(tabParam ?? 'vectors')
  const [configOpen, setConfigOpen] = useState(false)
  const [modelPicker, setModelPicker] = useState<'embedding' | 'extract' | null>(null)
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [pendingEmbedParts, setPendingEmbedParts] = useState<
    PendingEmbedCounts & { graphExtract?: number; graphDisambiguate?: number }
  >(
    () =>
      immediateOrganizePendingSnapshot(peekOrganizePendingSnapshot()) ?? EMPTY_PENDING_EMBED_COUNTS
  )
  const [pendingGraphCount, setPendingGraphCount] = useState(
    () => immediateOrganizePendingSnapshot(peekOrganizePendingSnapshot())?.graphExtract ?? 0
  )
  const [globalModels, setGlobalModels] = useState<GlobalModelsConfig | null>(null)
  const [ragConfig, setRagConfig] = useState<Pick<RagConfig, 'ragEnabled'> | null>(null)
  const [onboardingDismissed, setOnboardingDismissed] = useState(true)
  const [organizeSnapshotReady, setOrganizeSnapshotReady] = useState(() =>
    Boolean(immediateOrganizePendingSnapshot(peekOrganizePendingSnapshot()))
  )
  const [busy, setBusy] = useState(false)
  const [identityModalVisible, setIdentityModalVisible] = useState(false)
  const [identityModalProfile, setIdentityModalProfile] = useState<{
    nickname: string
    birthday?: string | null
    gender?: UserProfile['gender']
    customGender?: string | null
    showIdentityInProfile?: boolean
    shareIdentityWithCompanion?: boolean
  }>({
    nickname: '',
    birthday: null,
    gender: null,
    customGender: null,
    showIdentityInProfile: true,
    shareIdentityWithCompanion: true
  })
  const refreshInFlight = useRef<Promise<MemoryOrganizeRefreshSnapshot | null> | null>(null)
  const pendingAppliedFromNetwork = useRef(false)
  const organizePressLock = useRef(false)
  const { suspectCount } = useMobileSuspectCount()

  const handleSaveIdentityModal = useCallback(
    async (saved: SettingsProfileSavePayload) => {
      if (!services?.settingsManager) return
      try {
        const current = await getUserProfileFromSettings(services.settingsManager)
        const next: UserProfile = {
          ...current,
          nickname: saved.nickname,
          birthday: saved.birthday !== undefined ? saved.birthday : (current.birthday ?? null),
          gender: saved.gender !== undefined ? saved.gender : (current.gender ?? null),
          customGender:
            saved.customGender !== undefined ? saved.customGender : (current.customGender ?? null),
          showIdentityInProfile:
            saved.showIdentityInProfile !== undefined
              ? saved.showIdentityInProfile
              : (current.showIdentityInProfile ?? true),
          shareIdentityWithCompanion:
            saved.shareIdentityWithCompanion !== undefined
              ? saved.shareIdentityWithCompanion
              : (current.shareIdentityWithCompanion ?? true)
        }
        await saveUserProfileToSettings(services.settingsManager, next)
        if (normalizeGraphAwakenNickname(next.nickname)) {
          await services.settingsManager.set(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY, true)
        }
        setIdentityModalProfile({
          nickname: next.nickname,
          birthday: next.birthday,
          gender: next.gender,
          customGender: next.customGender,
          showIdentityInProfile: next.showIdentityInProfile,
          shareIdentityWithCompanion: next.shareIdentityWithCompanion
        })
        toast.showSuccess(t('common.save_success', '保存成功'))
        notifyUserProfileRefresh()
        notifyAgentProfileRefresh()
        setIdentityModalVisible(false)
        setTimeout(() => {
          void startOrganizeRef.current()
        }, 150)
      } catch (e) {
        logger.error(
          '[MemoryCenter] save identity modal failed',
          e instanceof Error ? e : { error: String(e) }
        )
        toast.showError(t('common.errors.save_failed', '保存失败，请重试'))
      }
    },
    [services, t, toast]
  )

  useEffect(() => {
    if (!tabParam) return
    setTab((prev) => (prev === tabParam ? prev : tabParam))
  }, [tabParam])

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current
    const applyLivePending = (
      embedCounts:
        | (PendingEmbedCounts & { graphExtract?: number; graphDisambiguate?: number })
        | null
    ): number | undefined => {
      const nextPending = embedCounts ?? EMPTY_PENDING_EMBED_COUNTS
      setPendingEmbedParts(nextPending)
      const snapshotExtract =
        embedCounts && 'graphExtract' in embedCounts ? embedCounts.graphExtract : undefined
      if (typeof snapshotExtract === 'number') {
        setPendingGraphCount(snapshotExtract)
        setOrganizeSnapshotReady(true)
        return snapshotExtract
      }
      return undefined
    }
    const task = (async (): Promise<MemoryOrganizeRefreshSnapshot | null> => {
      if (!dbReady || !services) return null
      const pendingPromise = loadMemoryOrganizePending(services.ragService)
      void pendingPromise.then((embedCounts) => {
        pendingAppliedFromNetwork.current = true
        applyLivePending(embedCounts)
      })
      const [models, rag, dismissed, providerList] = await Promise.all([
        services.settingsManager.get<GlobalModelsConfig>('global_models'),
        services.settingsManager.get<{ ragEnabled?: boolean }>('rag_config'),
        readMemoryOnboardingDismissed(),
        services.settingsManager.get<AIProviderConfig[]>('ai_providers'),
        readMemoryOrganizeInterrupted()
      ])
      const embedCounts = await pendingPromise
      const nextModels = models ? { ...getDefaultGlobalModels(), ...models } : null
      const nextProviders = Array.isArray(providerList) ? providerList : []
      const nextPending = embedCounts ?? EMPTY_PENDING_EMBED_COUNTS
      setGlobalModels(nextModels)
      setRagConfig(normalizeMemoryCenterRagConfig(rag))
      setOnboardingDismissed(dismissed)
      setProviders(nextProviders)

      let nextGraphCount = applyLivePending(embedCounts)
      if (typeof nextGraphCount !== 'number') {
        const activeVault = readActiveVaultSafely(services.vaultService)
        const vaultName = activeVault?.name || 'Personal'
        const vaultId = activeVault?.id ?? deriveLegacyVaultId(vaultName)
        try {
          const pending = await mobileListPendingReextract({
            vaultName,
            vaultId,
            shadowRepo: new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId),
            pathService: services.pathService,
            fileSystem: services.fileSystem
          })
          nextGraphCount = pending.length
        } catch {
          nextGraphCount = 0
        }
        setPendingEmbedParts(nextPending)
        setPendingGraphCount(nextGraphCount)
        setOrganizeSnapshotReady(true)
      }
      return {
        embeddingConfigured: isEmbeddingConfiguredForMemory(nextModels),
        extractConfigured: hasGraphModelConfigured(nextModels),
        pendingEmbedCount: nextPending.total,
        pendingGraphCount: nextGraphCount,
        livePending: nextPending,
        providers: nextProviders
      }
    })()
    refreshInFlight.current = task
    try {
      return await task
    } finally {
      if (refreshInFlight.current === task) refreshInFlight.current = null
    }
  }, [dbReady, services])

  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh])
  )

  useEffect(() => {
    void hydrateOrganizePendingSnapshot().then((snap) => {
      if (!snap || pendingAppliedFromNetwork.current) return
      if (!immediateOrganizePendingSnapshot(snap)) return
      setPendingEmbedParts(snap)
      setPendingGraphCount(snap.graphExtract)
      setOrganizeSnapshotReady(true)
    })
  }, [])

  useEffect(() => {
    if (!getBatchEmbedInFlight()) return
    const current = getCachedMobileRagState()
    if (current.isRunning && current.type === 'batchEmbed') return
    patchCachedMobileRagState({
      isRunning: true,
      type: 'batchEmbed',
      statusText: t('memory.readiness_organizing', '正在整理记忆…')
    })
  }, [t])

  useEffect(() => {
    return subscribeMobilePendingEmbedCountsChanged(() => {
      if (organizePressLock.current) return
      void refresh()
    })
  }, [refresh])

  const pendingEmbedCount = pendingEmbedParts.total
  const embeddingConfigured = isEmbeddingConfiguredForMemory(globalModels)
  const rows = useMemo(
    () =>
      buildMemoryReadinessRows({
        globalModels,
        ragConfig,
        pendingEmbedCount,
        pendingGraphCount
      }),
    [globalModels, ragConfig, pendingEmbedCount, pendingGraphCount]
  )
  const showOnboarding = shouldShowMemoryOnboarding({
    dismissed: onboardingDismissed,
    embeddingConfigured,
    pendingEmbedCount,
    pendingGraphCount
  })
  const onboarding = useMemo(
    () =>
      buildMemoryOnboardingModel({
        embeddingConfigured,
        pendingEmbedCount,
        pendingGraphCount
      }),
    [embeddingConfigured, pendingEmbedCount, pendingGraphCount]
  )

  const selectTab = (next: MemoryCenterTab) => {
    if (next === tab) return
    setTab(next)
    router.setParams({ tab: next })
  }

  const openModelPicker = (kind: 'embedding' | 'extract', providerList = providers) => {
    const filtered = filterProvidersForModelSwitcher(
      providerList,
      kind === 'embedding' ? 'embedding' : 'dialogue'
    )
    if (filtered.length === 0) {
      toast.showWarning(t('settings.no_models_available'))
      return
    }
    setModelPicker(kind)
  }

  const handleSelectPickedModel = async (
    providerId: string,
    modelId: string,
    effort?: ReasoningEffortSetting
  ) => {
    if (!services || !modelPicker) return
    const current =
      (await services.settingsManager.get<GlobalModelsConfig>('global_models')) ||
      getDefaultGlobalModels()

    if (modelPicker === 'embedding') {
      const isSwitching =
        current.globalEmbeddingProviderId &&
        current.globalEmbeddingModelId &&
        (current.globalEmbeddingProviderId !== providerId ||
          current.globalEmbeddingModelId !== modelId)
      if (isSwitching) {
        const confirmed = await dialog.confirm(t('agent.rag.migration_switch_warning_content'), {
          title: t('agent.rag.migration_switch_warning_title')
        })
        if (!confirmed) return
      }
      await services.settingsManager.set('global_models', {
        ...current,
        globalEmbeddingProviderId: providerId,
        globalEmbeddingModelId: modelId
      })
      const rag =
        (await services.settingsManager.get<RagConfig>('rag_config')) || ({} as Partial<RagConfig>)
      if (rag.ragEnabled === false) {
        await services.settingsManager.set('rag_config', { ...rag, ragEnabled: true })
      }
      try {
        await services.ragService.detectDimension()
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : t('settings.rag.detect_failed', '检测失败，请检查模型配置')
        )
      }
    } else {
      const reasoningEffortBySlot = effort
        ? setReasoningEffortForSlot(current.reasoningEffortBySlot, 'graph', effort)
        : current.reasoningEffortBySlot
      await services.settingsManager.set('global_models', {
        ...current,
        globalGraphProviderId: providerId,
        globalGraphModelId: modelId,
        reasoningEffortBySlot
      })
    }
    setModelPicker(null)
    await refresh()
  }

  const startOrganize = async () => {
    logger.info('[MemoryOrganize] start pressed', {
      hasServices: Boolean(services),
      pressLocked: organizePressLock.current,
      snapshotReady: organizeSnapshotReady,
      pendingEmbedCount,
      pendingGraphCount
    })
    if (!services || organizePressLock.current) {
      logger.warn('[MemoryOrganize] start ignored', {
        hasServices: Boolean(services),
        pressLocked: organizePressLock.current
      })
      return
    }
    organizePressLock.current = true
    try {
      let nextModels = globalModels
      let nextProviders = providers
      let livePending = pendingEmbedParts
      let liveEmbedCount = pendingEmbedCount
      let liveGraphCount = pendingGraphCount
      let embeddingOk = isEmbeddingConfiguredForMemory(nextModels)
      let extractOk = hasGraphModelConfigured(nextModels)
      if (!organizeSnapshotReady) {
        const loaded = await refresh()
        if (!loaded) {
          logger.warn('[MemoryOrganize] snapshot refresh returned empty')
          return
        }
        livePending = loaded.livePending
        liveEmbedCount = loaded.pendingEmbedCount
        liveGraphCount = loaded.pendingGraphCount
        nextProviders = loaded.providers
        embeddingOk = loaded.embeddingConfigured
        extractOk = loaded.extractConfigured
      } else if (nextModels === null) {
        const [models, providerList] = await Promise.all([
          services.settingsManager.get<GlobalModelsConfig>('global_models'),
          services.settingsManager.get<AIProviderConfig[]>('ai_providers')
        ])
        nextModels = models ? { ...getDefaultGlobalModels(), ...models } : getDefaultGlobalModels()
        nextProviders = Array.isArray(providerList) ? providerList : []
        setGlobalModels(nextModels)
        setProviders(nextProviders)
        embeddingOk = isEmbeddingConfiguredForMemory(nextModels)
        extractOk = hasGraphModelConfigured(nextModels)
      }
      const action = resolveMemoryOrganizeAction({
        embeddingConfigured: embeddingOk,
        extractConfigured: extractOk,
        pendingEmbedCount: liveEmbedCount
      })
      logger.info('[MemoryOrganize] resolved action', {
        action,
        embeddingOk,
        extractOk,
        liveEmbedCount,
        liveGraphCount
      })
      if (action === 'configure') {
        const prompt = resolveMemoryOrganizeConfigurePrompt({
          embeddingConfigured: embeddingOk,
          extractConfigured: extractOk
        }) ?? {
          toastKey: 'memory.need_models_to_organize' as const,
          picker: 'embedding' as const
        }
        toast.showInfo(
          t(
            prompt.toastKey,
            prompt.toastKey === 'memory.need_extract_to_organize'
              ? '请先配置图抽取模型，才能开始整理记忆'
              : prompt.toastKey === 'memory.need_embedding_to_organize'
                ? '接下来请先配置嵌入模型，才能整理记忆'
                : '请先配置嵌入模型和图抽取模型，才能开始整理记忆'
          )
        )
        openModelPicker(prompt.picker, nextProviders)
        return
      }
      if (
        isMemoryOrganizeIdle({
          pendingEmbedCount: liveEmbedCount,
          pendingGraphCount: liveGraphCount
        })
      ) {
        logger.info('[MemoryOrganize] nothing pending')
        toast.showInfo(t('memory.organize_nothing_pending', '无需整理'))
        return
      }
      if (liveGraphCount > 0) {
        const selfName = await ensureMobileGraphSelfName({
          settingsManager: services.settingsManager
        })
        if (!selfName) {
          const userProfile = await getUserProfileFromSettings(services.settingsManager)
          setIdentityModalProfile({
            nickname: isDefaultGraphSelfName(userProfile.nickname)
              ? ''
              : userProfile.nickname || '',
            birthday: userProfile.birthday ?? null,
            gender: userProfile.gender ?? null,
            customGender: userProfile.customGender ?? null,
            showIdentityInProfile: userProfile.showIdentityInProfile !== false,
            shareIdentityWithCompanion: userProfile.shareIdentityWithCompanion !== false
          })
          setIdentityModalVisible(true)
          return
        }
      }
      // graph 与 embed-then-graph 都走 batchEmbed；日记为 0 时 fill 仍会抽图与补向量
      const runtime = getAgentDbRuntime()
      if (runtime?.drizzleDb) {
        const activeVault = readActiveVaultSafely(services.vaultService)
        const vaultName = activeVault?.name || 'Personal'
        const vaultId = activeVault?.id ?? deriveLegacyVaultId(vaultName)
        mobileGraphExtractQueue.setContext({
          vaultId,
          vaultName,
          drizzleDb: runtime.drizzleDb,
          shadowRepo: new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId),
          pathService: services.pathService,
          fileSystem: services.fileSystem,
          settingsManager: services.settingsManager
        })
      }
      const snapshot = snapshotMemoryEmbedPhases(livePending, liveGraphCount)
      const organizing = t('memory.readiness_organizing', '正在整理记忆…')
      patchCachedMobileRagState({
        isRunning: true,
        type: 'batchEmbed',
        progress: 0,
        total: Math.max(snapshot.total, 1),
        statusText: organizing,
        error: undefined,
        paused: false,
        cancelling: false,
        phase: snapshot.phase,
        phases: snapshot.phases
      })
      setBusy(true)
      await writeMemoryOrganizeInterrupted(true)
      try {
        toast.showInfo(organizing)
        await waitForIdle()
        await (
          services.ragService as {
            batchEmbed?: () => Promise<number>
          }
        ).batchEmbed?.()
        await writeMemoryOrganizeInterrupted(false)
        await refresh()
      } catch (error) {
        patchCachedMobileRagState({ isRunning: false, type: 'idle', statusText: '' })
        if (isMemoryOrganizeCancelledError(error)) {
          toast.showSuccess(t('agent.stream_cancelled', '取消成功'))
          await refresh()
          return
        }
        logger.error(
          '[MemoryOrganize] batchEmbed failed',
          error instanceof Error ? error : String(error)
        )
        toast.showError(error instanceof Error ? error.message : String(error))
        await refresh()
      } finally {
        setBusy(false)
      }
    } finally {
      organizePressLock.current = false
    }
  }

  const startOrganizeRef = useRef(startOrganize)
  startOrganizeRef.current = startOrganize
  const onStartOrganize = useCallback(() => {
    const current = getCachedMobileRagState()
    if ((current.isRunning && current.type === 'batchEmbed') || organizePressLock.current) return
    void startOrganizeRef.current()
  }, [])
  const onUnifiedOrganize = useCallback(() => {
    void startOrganizeRef.current()
  }, [])

  const onOrganizePress = onStartOrganize

  const extractEffortLabel = globalModels
    ? formatReasoningEffortLabel(
        resolveReasoningEffortForSlot(globalModels.reasoningEffortBySlot, 'graph')
      )
    : undefined

  const readinessSettings = (
    <MemoryReadinessSettingsBody
      rows={rows}
      providers={providers}
      extractEffortLabel={extractEffortLabel}
      onPressEmbedding={() => openModelPicker('embedding')}
      onPressExtract={() => openModelPicker('extract')}
    />
  )

  const onboardingCard = showOnboarding ? (
    <Card style={{ marginBottom: tokens.spacing.sm }}>
      <Text style={[styles.onboardingTitle, { color: colors.textPrimary }]}>
        {t('memory.onboarding_title', '开始整理记忆')}
      </Text>
      {onboarding.steps.map((step) => (
        <Text
          key={step.id}
          style={{
            color: colors.textSecondary,
            marginTop: tokens.spacing.xs,
            fontSize: mobileTypography.secondary.fontSize,
            fontWeight: mobileTypography.secondary.fontWeight
          }}
        >
          {step.id === 'embed'
            ? t('memory.onboarding_step_embed', '配置嵌入模型')
            : step.id === 'vector'
              ? t('memory.onboarding_step_vector', '索引向量片段')
              : t('memory.onboarding_step_graph', '整理关系图谱')}
          {step.count != null ? ` · ${step.count}` : ''}
        </Text>
      ))}
      <View
        style={[styles.onboardingActions, { gap: tokens.spacing.sm, marginTop: tokens.spacing.md }]}
      >
        <Button
          variant="outlined"
          size="sm"
          onPress={() => {
            if (onboarding.primaryKind === 'configure') openModelPicker('embedding')
            else onOrganizePress()
          }}
        >
          {onboarding.primaryKind === 'configure'
            ? t('memory.go_configure', '去配置')
            : t('memory.onboarding_start', '开始整理记忆')}
        </Button>
        <Button
          variant="outlined"
          size="sm"
          onPress={() => {
            void writeMemoryOnboardingDismissed().then(() => setOnboardingDismissed(true))
          }}
        >
          {t('memory.onboarding_dismiss', '以后再说')}
        </Button>
      </View>
    </Card>
  ) : null

  return (
    <StackScreenLayout
      title={t('memory.title', '全局 AI 记忆')}
      {...chrome}
      onBack={() => router.back()}
    >
      {!dbReady ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom:
                insets.bottom + tokens.spacing.xl + tokens.spacing.xl + tokens.spacing.md
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.head,
                {
                  paddingBottom: tokens.spacing.sm,
                  paddingHorizontal: tokens.spacing.md,
                  paddingTop: tokens.spacing.mdTight
                }
              ]}
            >
              <View style={{ alignSelf: 'stretch' }}>
                <SegmentedControl
                  value={tab}
                  onChange={selectTab}
                  accessibilityLabel={t('memory.tabs', '记忆类型')}
                  options={[
                    { value: 'vectors', label: t('memory.tab_vectors', '向量片段') },
                    { value: 'graph', label: t('memory.tab_graph', '关系图谱') }
                  ]}
                />
              </View>
              {tab === 'graph' && suspectCount > 0 ? (
                <View style={[modalActionsStyle, { marginTop: tokens.spacing.sm }]}>
                  <Button variant="outlined" size="sm" onPress={() => router.push('/graph-review')}>
                    {t('memory.review_suspects', '去检查')}
                  </Button>
                </View>
              ) : null}
              <MemoryOrganizeProgressHost
                pendingEmbedParts={pendingEmbedParts}
                pendingGraphCount={pendingGraphCount}
                organizeSnapshotReady={organizeSnapshotReady}
                onStartOrganize={onStartOrganize}
              />
            </View>
            <SegmentedContent value={tab} style={{ flexGrow: 1, minHeight: 0 }}>
              {tab === 'vectors' ? (
                <View style={{ paddingHorizontal: tokens.spacing.md }}>
                  {onboardingCard}
                  <RAGMemorySection hideStats compactChrome settingsLead={readinessSettings} />
                </View>
              ) : (
                <View style={{ flexGrow: 1 }}>
                  {onboardingCard ? (
                    <View style={{ paddingHorizontal: tokens.spacing.md }}>{onboardingCard}</View>
                  ) : null}
                  <MemoryGraphPane onUnifiedOrganize={onUnifiedOrganize} />
                </View>
              )}
            </SegmentedContent>
          </ScrollView>
          <MemoryOrganizeFabHost
            pendingEmbedParts={pendingEmbedParts}
            pendingGraphCount={pendingGraphCount}
            organizeSnapshotReady={organizeSnapshotReady}
            busy={busy}
            fabBottom={insets.bottom + tokens.spacing.lg + tokens.spacing.md}
            onStartOrganize={onStartOrganize}
          />
        </View>
      )}
      <MemoryReadinessConfigModal
        visible={configOpen}
        rows={rows}
        providers={providers}
        extractEffortLabel={extractEffortLabel}
        onClose={() => setConfigOpen(false)}
        onPressEmbedding={() => openModelPicker('embedding')}
        onPressExtract={() => openModelPicker('extract')}
      />
      <ModelSwitcher
        isOpen={modelPicker !== null}
        onClose={() => setModelPicker(null)}
        providers={filterProvidersForModelSwitcher(
          providers,
          modelPicker === 'embedding' ? 'embedding' : 'dialogue'
        )}
        currentProviderId={
          modelPicker === 'extract'
            ? globalModels?.globalGraphProviderId
            : globalModels?.globalEmbeddingProviderId
        }
        currentModelId={
          modelPicker === 'extract'
            ? globalModels?.globalGraphModelId
            : globalModels?.globalEmbeddingModelId
        }
        onSelect={(providerId, modelId, effort) => {
          void handleSelectPickedModel(providerId, modelId, effort)
        }}
        onManageProviders={() => {
          setModelPicker(null)
          router.push('/settings/ai-services')
        }}
        showReasoningPanel={modelPicker === 'extract'}
        reasoningEffort={
          modelPicker === 'extract'
            ? resolveReasoningEffortForSlot(globalModels?.reasoningEffortBySlot, 'graph')
            : 'auto'
        }
      />
      <SettingsProfileModal
        visible={identityModalVisible}
        onClose={() => setIdentityModalVisible(false)}
        profile={identityModalProfile}
        onSave={handleSaveIdentityModal}
      />
    </StackScreenLayout>
  )
}

const MemoryGraphPane = React.memo(function MemoryGraphPane(props: {
  onUnifiedOrganize: () => void | Promise<void>
}) {
  return <GraphScreen embedded onUnifiedOrganize={props.onUnifiedOrganize} />
})

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: {},
  onboardingTitle: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: mobileTypography.title.fontWeight
  },
  onboardingActions: { flexDirection: 'row', flexWrap: 'wrap' }
})
