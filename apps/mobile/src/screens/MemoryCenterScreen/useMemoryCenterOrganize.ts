import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  deriveLegacyVaultId,
  filterProvidersForModelSwitcher,
  getUserProfileFromSettings,
  hasGraphModelConfigured,
  isDefaultGraphSelfName,
  isEmbeddingConfiguredForMemory,
  localizeAiApiErrorMessage,
  logger,
  normalizeGraphAwakenNickname,
  resolveMemoryOrganizeAction,
  resolveMemoryOrganizeConfigurePrompt,
  saveUserProfileToSettings,
  setReasoningEffortForSlot,
  waitForIdle,
  type AIProviderConfig,
  type GlobalModelsConfig,
  type RagConfig,
  type ReasoningEffortSetting,
  type UserProfile
} from '@baishou/shared'
import { getDefaultGlobalModels } from '@baishou/store'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { mobileGraphExtractQueue } from '@/src/services/mobile-graph-extract-queue.service'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import { syncMobileSelfPersonNodeOnRename } from '@/src/services/mobile-graph.service'
import { subscribeMobilePendingEmbedCountsChanged } from '@/src/services/mobile-pending-embed-counts'
import {
  isMemoryOrganizeCancelledError,
  isMemoryOrganizeIdle,
  snapshotMemoryEmbedPhases
} from './memory-center-organize.util'
import { ensureMobileGraphSelfName } from '../DiaryScreen/ensure-graph-self-name'
import {
  getCachedMobileRagState,
  patchCachedMobileRagState
} from '@/src/services/mobile-rag-runtime-cache'
import { writeMemoryOrganizeInterrupted } from './memory-center-organize.storage'
import { readActiveVaultSafely } from './memory-center-data.util'
import type { SettingsProfileSavePayload } from '../SettingsScreen/components/SettingsProfileModal'
import { notifyUserProfileRefresh } from '@/src/lib/user-profile-refresh-signal'
import { notifyAgentProfileRefresh } from '../SettingsScreen/components/settings-account-profile.util'
import type { MemoryOrganizeRefreshSnapshot, MemoryPendingPartCounts } from './useMemoryCenterData'

type ModelPickerKind = 'embedding' | 'extract'

type IdentityModalProfile = {
  nickname: string
  birthday?: string | null
  gender?: UserProfile['gender']
  customGender?: string | null
  showIdentityInProfile?: boolean
  shareIdentityWithCompanion?: boolean
}

/**
 * 记忆中心的整理动作：模型切换、身份补全弹窗和 batchEmbed 启动流程。
 * 数据读取与刷新由 useMemoryCenterData 提供。
 */
export function useMemoryCenterOrganize(input: {
  globalModels: GlobalModelsConfig | null
  providers: AIProviderConfig[]
  pendingEmbedParts: MemoryPendingPartCounts
  pendingGraphCount: number
  organizeSnapshotReady: boolean
  refresh: () => Promise<MemoryOrganizeRefreshSnapshot | null>
  setGlobalModels: Dispatch<SetStateAction<GlobalModelsConfig | null>>
  setProviders: Dispatch<SetStateAction<AIProviderConfig[]>>
}) {
  const { t } = useTranslation()
  const { services } = useBaishou()
  const toast = useNativeToast()
  const dialog = useDialog()
  const {
    globalModels,
    providers,
    pendingEmbedParts,
    pendingGraphCount,
    organizeSnapshotReady,
    refresh,
    setGlobalModels,
    setProviders
  } = input
  const [modelPicker, setModelPicker] = useState<ModelPickerKind | null>(null)
  const [busy, setBusy] = useState(false)
  const [identityModalVisible, setIdentityModalVisible] = useState(false)
  const [identityModalProfile, setIdentityModalProfile] = useState<IdentityModalProfile>({
    nickname: '',
    birthday: null,
    gender: null,
    customGender: null,
    showIdentityInProfile: true,
    shareIdentityWithCompanion: true
  })
  const organizePressLock = useRef(false)

  const pendingEmbedCount = pendingEmbedParts.total

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
        const runtime = getAgentDbRuntime()
        if (runtime?.drizzleDb) {
          const activeVault = readActiveVaultSafely(services.vaultService)
          const vaultName = activeVault?.name || 'Personal'
          const vaultId = activeVault?.id ?? deriveLegacyVaultId(vaultName)
          await syncMobileSelfPersonNodeOnRename({
            drizzleDb: runtime.drizzleDb,
            pathService: services.pathService,
            fileSystem: services.fileSystem,
            vaultId,
            vaultDisplayName: vaultName,
            oldName: current.nickname,
            newName: next.nickname
          })
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
    return subscribeMobilePendingEmbedCountsChanged(() => {
      if (organizePressLock.current) return
      void refresh()
    })
  }, [refresh])

  const openModelPicker = (kind: ModelPickerKind, providerList = providers) => {
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
      pendingGraphCount: pendingGraphCount
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
        if (isMemoryOrganizeCancelledError(error)) {
          patchCachedMobileRagState({
            isRunning: false,
            type: 'idle',
            statusText: '',
            error: undefined
          })
          toast.showSuccess(t('agent.stream_cancelled', '取消成功'))
          await refresh()
          return
        }
        const friendlyError = localizeAiApiErrorMessage(error, t)
        patchCachedMobileRagState({
          isRunning: false,
          type: 'idle',
          statusText: '',
          error: friendlyError
        })
        logger.error(
          '[MemoryOrganize] batchEmbed failed',
          error instanceof Error ? error : String(error)
        )
        toast.showError(friendlyError)
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

  const closeModelPicker = useCallback(() => setModelPicker(null), [])
  const closeIdentityModal = useCallback(() => setIdentityModalVisible(false), [])

  return {
    modelPicker,
    openModelPicker,
    closeModelPicker,
    handleSelectPickedModel,
    handleSaveIdentityModal,
    identityModalVisible,
    identityModalProfile,
    closeIdentityModal,
    busy,
    onStartOrganize,
    onOrganizePress: onStartOrganize,
    onUnifiedOrganize
  }
}
