import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  formatDialogueModelLabel,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  resolveDialogueModelSelection,
  type GlobalModelsConfig
} from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import { useAgentNavigationStore } from '@baishou/store'
import { listAssistantsForUi, type MobileAssistantUi } from '../lib/mobile-assistant.util'
import { waitForVaultEcosystemResync } from '../services/mobile-vault-resync.service'

type Assistant = MobileAssistantUi

export interface UseAgentModelOptions {
  /** 当前会话 ID（ref），用于按会话绑定并持久化模型选择 */
  currentSessionIdRef?: MutableRefObject<string | null>
}

export function useAgentModel(options: UseAgentModelOptions = {}) {
  const { currentSessionIdRef } = options
  const { services, dbReady, storageReady, vaultRevision, storageIndexing, ecosystemResyncEpoch } =
    useBaishou()

  const [currentAssistant, setCurrentAssistant] = useState<Assistant | null>(null)
  const [showAssistantPicker, setShowAssistantPicker] = useState(false)
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)

  const [globalModels, setGlobalModels] = useState<GlobalModelsConfig | null>(null)
  const [currentProviderId, setCurrentProviderId] = useState<string | null>(null)
  const [currentModelId, setCurrentModelId] = useState<string | null>(null)

  /** 用户手动选模或已从会话恢复模型时，跳过伙伴/全局默认覆盖 */
  const userManuallySetModelRef = useRef(false)
  const prevSessionIdRef = useRef<string | null | undefined>(undefined)
  const lastSyncedDbReadyRef = useRef(false)

  const applyResolvedModel = useCallback(
    (assistant: Assistant | null, models: GlobalModelsConfig | null) => {
      if (userManuallySetModelRef.current) return

      const resolved = resolveDialogueModelSelection({
        assistantProviderId: assistant?.providerId,
        assistantModelId: assistant?.modelId,
        globalDialogueProviderId: models?.globalDialogueProviderId,
        globalDialogueModelId: models?.globalDialogueModelId
      })

      setCurrentProviderId(resolved.providerId)
      setCurrentModelId(resolved.modelId)
    },
    []
  )

  const loadSessionDialogueModel = useCallback(
    async (sessionId: string): Promise<{ providerId: string; modelId: string } | null> => {
      if (!services || !dbReady) return null
      try {
        const session = await services.sessionRepo.getSessionById(sessionId)
        if (
          session &&
          isConfiguredProviderId(session.providerId) &&
          isConfiguredDialogueModelId(session.modelId)
        ) {
          return {
            providerId: session.providerId.trim(),
            modelId: session.modelId.trim()
          }
        }
      } catch (e) {
        console.warn('Failed to load session model', e)
      }
      return null
    },
    [services, dbReady]
  )

  const applySessionDialogueModel = useCallback((providerId: string, modelId: string) => {
    userManuallySetModelRef.current = true
    setCurrentProviderId(providerId)
    setCurrentModelId(modelId)
  }, [])

  const syncWithSession = useCallback(
    async (sessionId: string | null | undefined) => {
      const normalizedSessionId = sessionId ?? null
      const sessionChanged = prevSessionIdRef.current !== normalizedSessionId
      const dbBecameReady = dbReady && !lastSyncedDbReadyRef.current
      lastSyncedDbReadyRef.current = dbReady

      if (!sessionChanged && !dbBecameReady) return

      const prevSessionId = prevSessionIdRef.current
      prevSessionIdRef.current = normalizedSessionId

      // 首条消息内联创建会话：保留当前已选模型，避免被伙伴/全局默认覆盖为「未选择」
      if (
        !prevSessionId &&
        normalizedSessionId &&
        isConfiguredProviderId(currentProviderId) &&
        isConfiguredDialogueModelId(currentModelId)
      ) {
        return
      }

      if (!normalizedSessionId) {
        userManuallySetModelRef.current = false
        applyResolvedModel(currentAssistant, globalModels)
        return
      }

      const sessionModel = await loadSessionDialogueModel(normalizedSessionId)
      if (sessionModel) {
        applySessionDialogueModel(sessionModel.providerId, sessionModel.modelId)
        return
      }

      userManuallySetModelRef.current = false
      applyResolvedModel(currentAssistant, globalModels)
    },
    [
      applyResolvedModel,
      applySessionDialogueModel,
      currentAssistant,
      globalModels,
      currentProviderId,
      currentModelId,
      loadSessionDialogueModel,
      dbReady
    ]
  )

  useEffect(() => {
    applyResolvedModel(currentAssistant, globalModels)
  }, [currentAssistant, globalModels, applyResolvedModel])

  /** 从设置页返回时重载 global_models（桌面端由 settings store 响应式同步） */
  const reloadGlobalModels = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      const nextGlobalModels =
        (await services.settingsManager.get<GlobalModelsConfig>('global_models')) || null
      setGlobalModels(nextGlobalModels)
    } catch (e) {
      console.warn('Failed to reload global models', e)
    }
  }, [dbReady, services])

  useFocusEffect(
    useCallback(() => {
      void reloadGlobalModels()
    }, [reloadGlobalModels])
  )

  // 加载默认助手和全局模型；工作区切换后随 vaultRevision 重载（对齐桌面 AgentLayout）
  useEffect(() => {
    if (!dbReady || !services || !storageReady) return

    const loadDefaultConfig = async () => {
      try {
        if (storageIndexing) {
          await waitForVaultEcosystemResync()
        }

        const assistants = await listAssistantsForUi(
          services.assistantManager,
          services.attachmentManager,
          services.fileSystem,
          { preferFileUri: true, skipAvatarResolve: true }
        )

        const nextGlobalModels =
          (await services.settingsManager.get<GlobalModelsConfig>('global_models')) || null
        setGlobalModels(nextGlobalModels)

        const vaultKey = await services.pathService.getActiveVaultNameForContext()
        const persisted = useAgentNavigationStore.getState().getContext(vaultKey)

        setCurrentAssistant((prev) => {
          const stillValid = prev && assistants.find((a) => a.id === prev.id)
          const fromPersisted =
            persisted.assistantId &&
            assistants.find((assistant) => assistant.id === persisted.assistantId)
          const next =
            stillValid ||
            fromPersisted ||
            assistants.find((a) => a.isDefault) ||
            assistants[0] ||
            null
          if (!userManuallySetModelRef.current) {
            applyResolvedModel(next, nextGlobalModels)
          }
          return next
        })
      } catch (e) {
        console.warn('Failed to load default config', e)
      }
    }

    void loadDefaultConfig()
  }, [
    dbReady,
    services,
    storageReady,
    vaultRevision,
    storageIndexing,
    ecosystemResyncEpoch,
    applyResolvedModel
  ])

  const handleSelectAssistant = useCallback(
    (assistant: Assistant) => {
      setCurrentAssistant(assistant)
      setShowAssistantPicker(false)
      userManuallySetModelRef.current = false
      applyResolvedModel(assistant, globalModels)
    },
    [applyResolvedModel, globalModels]
  )

  const handleSelectModel = useCallback(
    async (providerId: string, modelId: string) => {
      applySessionDialogueModel(providerId, modelId)
      setShowModelSwitcher(false)

      const sessionId = currentSessionIdRef?.current ?? null
      if (
        !sessionId ||
        !services ||
        !dbReady ||
        !isConfiguredProviderId(providerId) ||
        !isConfiguredDialogueModelId(modelId)
      ) {
        return
      }

      try {
        await services.sessionManager.updateSessionDialogueModel(sessionId, providerId, modelId)
      } catch (e) {
        console.warn('Failed to persist session model', e)
      }
    },
    [applySessionDialogueModel, currentSessionIdRef, services, dbReady]
  )

  const displayModelName = formatDialogueModelLabel(currentModelId)
  const hasConfiguredDialogueModel =
    isConfiguredProviderId(currentProviderId) && isConfiguredDialogueModelId(currentModelId)

  return {
    currentAssistant,
    currentProviderId,
    currentModelId,
    displayModelName,
    hasConfiguredDialogueModel,
    globalModels,
    showAssistantPicker,
    showModelSwitcher,
    setCurrentAssistant,
    setCurrentProviderId,
    setCurrentModelId,
    setShowAssistantPicker,
    setShowModelSwitcher,
    handleSelectAssistant,
    handleSelectModel,
    syncWithSession
  }
}
